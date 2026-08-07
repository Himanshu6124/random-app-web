/**
 * Authentication & User Service connecting to the real RandoMeet backend.
 *
 * Endpoints:
 *   POST /auth/login              -> LoginRequest { username, password } -> AuthResponse { userId, jwt }
 *   POST /auth/signup             -> User model payload -> AuthResponse { userId, jwt }
 *   GET  /api/user/getuser/{id}   -> User profile (Bearer JWT)
 *   PUT  /api/user/update/{id}    -> Update user profile (Bearer JWT)
 *   GET  /users/profile-pictures  -> String[] of avatar URLs
 *   GET  /api/friends/{userId}    -> List<FriendDto> (Bearer JWT)
 *   POST /api/friends/add         -> Add friend { userId, friendId } (Bearer JWT)
 *   DELETE /api/friends/remove/{friendId} -> Remove friend (Bearer JWT)
 *
 * AuthResponse fields: { userId: String, jwt: String }
 *
 * NOTE: BASE_URL is intentionally empty — all requests are routed through
 * the Vite dev server proxy (vite.config.js) to avoid CORS issues.
 * The proxy forwards /auth/*, /api/*, /users/*, /friends/* -> http://192.168.1.7:8080
 */

const BASE_URL = '';  // Proxied via Vite — see vite.config.js
const TOKEN_KEY = 'randomeet_jwt_token';
const USER_ID_KEY = 'randomeet_user_id';
const USER_KEY = 'randomeet_user';

export const authService = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  getUserId() {
    return localStorage.getItem(USER_ID_KEY);
  },

  getUser() {
    const saved = localStorage.getItem(USER_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved user', e);
      }
    }
    return null;
  },

  setSession(authResponse, user) {
    // authResponse: { userId, jwt }
    if (authResponse?.jwt) {
      localStorage.setItem(TOKEN_KEY, authResponse.jwt);
    }
    if (authResponse?.userId) {
      localStorage.setItem(USER_ID_KEY, authResponse.userId);
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_KEY);
  },

  /**
   * POST /auth/login
   * Body: { username, password }
   * Returns: { authResponse: { userId, jwt }, user }
   */
  async login(username, password) {
    if (!username || !password) {
      throw new Error('Please enter both username and password.');
    }

    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      let errMsg = `Login failed (${response.status})`;
      try {
        const errorData = await response.json();
        errMsg = errorData.message || errorData.error || errMsg;
      } catch {
        const text = await response.text().catch(() => '');
        if (text) errMsg = text;
      }
      throw new Error(errMsg);
    }

    const data = await response.json();
    // AuthResponse: { userId, jwt }
    const jwt = data.jwt || data.jwtToken || data.token;
    const userId = data.userId || data.id;

    if (!jwt) {
      throw new Error('Server did not return a valid JWT token.');
    }

    const authResponse = { userId, jwt };

    // Attempt to fetch full profile; fall back to minimal local model
    let userModel = null;
    try {
      userModel = await this.fetchUserProfile(userId, jwt);
    } catch (e) {
      console.warn('Could not fetch remote user profile, using fallback.', e);
    }

    if (!userModel) {
      userModel = {
        id: userId,
        username,
        name: username,
        gender: '',
        photoUrl: '',
        bio: '',
        status: 'Online'
      };
    }

    this.setSession(authResponse, userModel);
    return { authResponse, user: userModel };
  },

  /**
   * POST /auth/signup
   * Body: User model (matches KMP User data class)
   * Returns: { authResponse: { userId, jwt }, user }
   */
  async signUp(userData) {
    const { username, password, name, email, gender, bio, photoUrl, interests } = userData;

    if (!username || !password) {
      throw new Error('Username and password are required.');
    }

    // Matches KMP User data class fields
    const userPayload = {
      username: username.trim(),
      password: password.trim(),
      name: name?.trim() || username.trim(),
      email: email?.trim() || '',
      gender: gender || '',
      bio: bio?.trim() || '',
      photoUrl: photoUrl || '',
      location: '',
      status: 'Online',
      suspectLevel: 0,
      lastOnline: new Date().toISOString(),
      fcmToken: ''
    };

    const response = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(userPayload)
    });

    if (!response.ok) {
      let errMsg = `Sign up failed (${response.status})`;
      try {
        const errorData = await response.json();
        errMsg = errorData.message || errorData.error || errMsg;
      } catch {
        const text = await response.text().catch(() => '');
        if (text) errMsg = text;
      }
      throw new Error(errMsg);
    }

    const data = await response.json();
    const jwt = data.jwt || data.jwtToken || data.token;
    const userId = data.userId || data.id;

    if (!jwt) {
      throw new Error('Sign up server did not return a valid JWT token.');
    }

    const authResponse = { userId, jwt };

    // Build the user model saved locally
    const savedUser = {
      id: userId,
      ...userPayload,
      interests: interests || []
    };

    this.setSession(authResponse, savedUser);
    return { authResponse, user: savedUser };
  },

  /**
   * GET /api/user/getuser/{userId}
   * Headers: Authorization: Bearer <jwt>
   */
  async fetchUserProfile(userId, token) {
    const res = await fetch(`${BASE_URL}/api/user/getuser/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch user profile (${res.status})`);
    }

    return await res.json();
  },

  /**
   * PUT /api/user/update/{userId}
   * Headers: Authorization: Bearer <jwt>
   * Body: partial/full user fields
   * Returns: updated User or 200 OK
   */
  async updateProfile(userId, token, profileData) {
    const res = await fetch(`${BASE_URL}/api/user/update/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(profileData)
    });

    if (!res.ok) {
      let errMsg = `Profile update failed (${res.status})`;
      try {
        const err = await res.json();
        errMsg = err.message || err.error || errMsg;
      } catch {
        const text = await res.text().catch(() => '');
        if (text) errMsg = text;
      }
      throw new Error(errMsg);
    }

    try {
      return await res.json();
    } catch {
      return profileData; // server returned no body (204 No Content)
    }
  },

  /**
   * GET /api/friends/{userId}
   * Returns: List<FriendDto> — all accepted friendships
   * FriendDto fields (from getAllFriends service): { id, name, username, photoUrl, bio, gender, status }
   */
  async getFriends(userId, token) {
    try {
      const res = await fetch(`${BASE_URL}/api/friends/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch friends (${res.status})`);
      }

      const friends = await res.json();
      // Normalize FriendDto to match our local shape
      return Array.isArray(friends) ? friends.map(f => ({
        id: f.id || f.userId || f.friendId,
        name: f.name || f.username || 'Friend',
        username: f.username || f.name,
        photoUrl: f.photoUrl || f.avatar || '',
        bio: f.bio || '',
        gender: f.gender || '',
        status: f.status || 'Online',
        lastMessage: f.lastMessage || 'Say hi!',
        unread: f.unread || 0
      })) : [];
    } catch (e) {
      console.warn('[authService] getFriends failed, using local cache:', e);
      return null; // null = caller should use localStorage friends
    }
  },

  /**
   * POST /api/friends/add
   * Body: { userId, friendId }
   * Headers: Authorization: Bearer <jwt>
   */
  async addFriendApi(myUserId, token, friendId) {
    try {
      const res = await fetch(`${BASE_URL}/api/friends/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ userId: myUserId, friendId })
      });

      if (!res.ok) {
        throw new Error(`Add friend failed (${res.status})`);
      }
      return true;
    } catch (e) {
      console.warn('[authService] addFriendApi failed (graceful):', e);
      return false; // gracefully fall back to localStorage-only
    }
  },

  /**
   * DELETE /api/friends/remove/{friendId}
   * Headers: Authorization: Bearer <jwt>
   */
  async removeFriendApi(myUserId, token, friendId) {
    try {
      const res = await fetch(`${BASE_URL}/api/friends/remove/${friendId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`Remove friend failed (${res.status})`);
      }
      return true;
    } catch (e) {
      console.warn('[authService] removeFriendApi failed (graceful):', e);
      return false;
    }
  },

  /**
   * GET /users/profile-pictures
   * Returns: String[] of avatar image URLs
   */
  async getProfilePictures() {
    console.log("Fetching profile pictures from backend...", BASE_URL);
    try {
      const res = await fetch(`${BASE_URL}/users/profile-pictures`, {
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch profile pictures (${res.status})`);
      }

      return await res.json();
    } catch (e) {
      console.warn('Could not fetch profile pictures:', e);
      return [];
    }
  },

  /**
   * Verify stored JWT token on page load.
   * Calls GET /api/user/getuser/{userId} to validate.
   */
  async checkLandingAuth() {
    const token = this.getToken();
    const userId = this.getUserId();
    const user = this.getUser();

    if (!token || !userId) {
      return { isAuthenticated: false, user: null, jwt: null };
    }

    try {
      const remoteUser = await this.fetchUserProfile(userId, token);
      const updatedUser = { id: userId, ...remoteUser };
      this.setSession({ userId, jwt: token }, updatedUser);
      return { isAuthenticated: true, user: updatedUser, jwt: token };
    } catch (err) {
      console.warn('Token verification failed, using local session if available.', err);
      // If we have local user data, trust it (e.g. backend unreachable)
      if (user && token) {
        return { isAuthenticated: true, user, jwt: token };
      }
      this.clearSession();
      return { isAuthenticated: false, user: null, jwt: null };
    }
  }
};
