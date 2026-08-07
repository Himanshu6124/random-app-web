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
 */

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || '';
const BASE_URL = rawBackendUrl.replace(/\/+$/, '');
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
    if (!photoUrl || !photoUrl.trim()) {
      throw new Error('Profile picture is required.');
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
      fcmToken: '',
      interests: interests || []
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

    const data = await res.json();
    return {
      id: data.username || data.id || userId,
      name: data.name || data.username || userId,
      username: data.username || userId,
      email: data.email || '',
      gender: data.gender || '',
      bio: data.bio || '',
      photoUrl: data.photoUrl || '',
      location: data.location || '',
      interests: data.interests || [],
      ...data
    };
  },

  /**
   * PATCH /api/user/update/{userId}
   * Headers: Authorization: Bearer <jwt>
   * Body: partial/full user fields
   * Returns: updated User or 200 OK
   */
  async updateProfile(userId, token, profileData) {
    const res = await fetch(`${BASE_URL}/api/user/update/${userId}`, {
      method: 'PATCH',
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
      const data = await res.json();
      return { id: data.username || data.id || userId, ...data };
    } catch {
      return profileData; // server returned no body (204 No Content)
    }
  },


  /**
   * GET /conversations/my-conversations
   * Returns: List<Conversation> — friend conversations from backend
   */
  async getFriendConversations(token) {
    try {
      const res = await fetch(`${BASE_URL}/conversations/my-conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch friend conversations (${res.status})`);
      }

      const conversations = await res.json();
      return Array.isArray(conversations) ? conversations.map(c => ({
        id: c.friendUserId || c.peerId || c.id || c.conversationId,
        conversationId: c.conversationId || c.id,
        peerId: c.peerId || c.friendUserId || c.id,
        friendUserId: c.friendUserId || c.peerId || c.id,
        friendUserName: c.friendUserName || c.name || c.username || 'Friend',
        name: c.friendUserName || c.name || c.username || 'Friend',
        username: c.username || c.friendUserName,
        photoUrl: c.friendPhotoUrl || c.photoUrl || c.avatar || '',
        avatar: c.avatar || '👤',
        status: c.status || 'Online',
        lastMessage: c.lastMessage || 'Say hi!',
        lastMessageTime: c.lastMessageTime || c.timestamp || '',
        unread: c.unread || 0
      })) : [];
    } catch (e) {
      console.warn('[authService] getFriendConversations failed:', e);
      return null;
    }
  },


  /**
   * GET /messages/conversation/{conversationId}?page={page}&size={size}
   * Headers: Authorization: Bearer <jwt>
   * Returns: List<Message> from backend matching RandoMeet ChatRepo
   */
  async fetchConversationMessages(conversationId, token, page = 0, size = 20) {
    if (!conversationId || !token) return [];

    try {
      const myId = this.getUserId();
      const res = await fetch(`${BASE_URL}/messages/conversation/${conversationId}?page=${page}&size=${size}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch conversation messages (${res.status})`);
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
      
      // Reversing list so messages display chronologically from oldest at top to newest at bottom
      const chronologicalList = list.slice().reverse();

      return chronologicalList.map(m => {
        const isMe = (m.senderId && String(m.senderId) === String(myId)) || m.sender === 'me';
        return {
          id: m.id || 'msg_' + Math.random(),
          sender: isMe ? 'me' : (m.senderId || 'peer'),
          senderId: m.senderId || '',
          text: m.message || m.text || m.content || '',
          time: m.timeStamp || m.timestamp 
            ? new Date(m.timeStamp || m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      });
    } catch (e) {
      console.warn('[authService] fetchConversationMessages failed:', e);
      return [];
    }
  },



  /**
   * GET /friendships/list
   * Returns: List<User> — accepted friends
   */
  async getFriendsList(token) {
    try {
      const res = await fetch(`${BASE_URL}/friendships/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch friendships list (${res.status})`);
      }

      return await res.json();
    } catch (e) {
      console.warn('[authService] getFriendsList failed:', e);
      return [];
    }
  },

  /**
   * GET /friendships/to-be-accepted
   * Returns: List<User> — pending friend requests to be accepted
   */
  async getPendingFriendRequests(token) {
    try {
      const res = await fetch(`${BASE_URL}/friendships/to-be-accepted`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch pending friend requests (${res.status})`);
      }

      const requests = await res.json();
      return Array.isArray(requests) ? requests.map(r => ({
        id: r.id || r.userId || r.username,
        username: r.username || r.name,
        name: r.name || r.username || 'Unknown',
        photoUrl: r.photoUrl || r.avatar || '',
        bio: r.bio || ''
      })) : [];
    } catch (e) {
      console.warn('[authService] getPendingFriendRequests failed:', e);
      return [];
    }
  },

  /**
   * POST /friendships/request/{friendId}/send
   * Send a friend request to friendId (userId or username)
   */
  async sendFriendRequest(friendId, token) {
    const res = await fetch(`${BASE_URL}/friendships/request/${friendId}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      let errMsg = `Send friend request failed (${res.status})`;
      try {
        const err = await res.json();
        errMsg = err.message || err.error || errMsg;
      } catch {
        const text = await res.text().catch(() => '');
        if (text) errMsg = text;
      }
      throw new Error(errMsg);
    }
    return true;
  },

  /**
   * POST /friendships/request/{friendId}/accept
   * Accept a pending friend request
   */
  async acceptFriendRequest(friendId, token) {
    const res = await fetch(`${BASE_URL}/friendships/request/${friendId}/accept`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      let errMsg = `Accept friend request failed (${res.status})`;
      try {
        const err = await res.json();
        errMsg = err.message || err.error || errMsg;
      } catch {
        const text = await res.text().catch(() => '');
        if (text) errMsg = text;
      }
      throw new Error(errMsg);
    }
    return true;
  },

  /**
   * POST /friendships/request/{friendId}/reject
   * Reject a pending friend request
   */
  async rejectFriendRequest(friendId, token) {
    const res = await fetch(`${BASE_URL}/friendships/request/${friendId}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      let errMsg = `Reject friend request failed (${res.status})`;
      try {
        const err = await res.json();
        errMsg = err.message || err.error || errMsg;
      } catch {
        const text = await res.text().catch(() => '');
        if (text) errMsg = text;
      }
      throw new Error(errMsg);
    }
    return true;
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
