/**
 * Authentication & Backend REST Service connecting to chat-backend.
 *
 * Conforms 100% to FRONTEND_INTEGRATION_GUIDE.md specifications.
 */

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || '';
const BASE_URL = rawBackendUrl.replace(/\/+$/, '');
const TOKEN_KEY = 'randomeet_jwt_token';
const USER_ID_KEY = 'randomeet_user_id';
const USER_KEY = 'randomeet_user';

/**
 * Parses and handles backend API responses adhering to ApiError schema.
 */
async function handleApiResponse(response) {
  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const errorBody = await response.json();
      if (errorBody && errorBody.error) {
        errorMessage = errorBody.error;
      } else if (errorBody && errorBody.message) {
        errorMessage = errorBody.message;
      }
    } catch {
      const text = await response.text().catch(() => '');
      if (text) errorMessage = text;
    }
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/**
 * Returns auth headers including Bearer token if present.
 */
function getAuthHeaders(token) {
  const activeToken = token || localStorage.getItem(TOKEN_KEY);
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }
  return headers;
}

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
    try {
      if (authResponse?.jwt) {
        localStorage.setItem(TOKEN_KEY, authResponse.jwt);
      }
      if (authResponse?.userId) {
        localStorage.setItem(USER_ID_KEY, authResponse.userId);
      }
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }
    } catch (e) {
      console.warn('[authService] Could not persist session to localStorage:', e);
    }
  },

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_KEY);
  },

  // ==========================================
  // Authentication Endpoints
  // ==========================================

  /**
   * POST /auth/firebase
   * Step 1 of Google sign-in: exchange a verified Firebase ID token for either an app
   * session (returning user / linked email) or a NEEDS_USERNAME response with a
   * short-lived registration token.
   * Returns: { status, registrationToken?, suggestedUsername?, name?, email?, photoUrl?,
   *            jwt?, userId?, username?, isGuest? }
   */
  async firebaseSignIn(idToken) {
    const response = await fetch(`${BASE_URL}/auth/firebase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    return await handleApiResponse(response);
  },

  /**
   * POST /auth/firebase/complete
   * Step 2 for brand-new Google users: claim a username and create the account.
   * Returns the same shape as firebaseSignIn with jwt/userId populated.
   */
  async firebaseCompleteSignup(registrationToken, { username, name, gender, photoUrl }) {
    const response = await fetch(`${BASE_URL}/auth/firebase/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ registrationToken, username, name, gender, photoUrl })
    });
    return await handleApiResponse(response);
  },

  /**
   * POST /auth/firebase/link
   * Guest upgrades to Google mid-chat. Same stable user id — the active chat survives.
   * Requires the caller's current JWT.
   */
  async firebaseLinkAccount(idToken, { username, name, gender, photoUrl } = {}, token) {
    const response = await fetch(`${BASE_URL}/auth/firebase/link`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ idToken, username, name, gender, photoUrl })
    });
    return await handleApiResponse(response);
  },

  /**
   * POST /auth/login
   * Body: { username, password }
   * Returns: { jwt, userId }
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
      body: JSON.stringify({ username: username.trim(), password })
    });

    const data = await handleApiResponse(response);
    const jwt = data.jwt;
    // userId is the STABLE INTERNAL ID issued by the backend - never the typed handle.
    const userId = data.userId;

    const authResponse = { userId, jwt };

    // Fetch user profile from GET /users/me
    let userModel = null;
    try {
      userModel = await this.getCurrentUser(jwt);
    } catch (e) {
      console.warn('Could not fetch user profile via /users/me, using fallback.', e);
      userModel = {
        id: userId,
        username: data.username || username.trim(),
        name: data.name || data.username || username.trim(),
        gender: '',
        photoUrl: '',
        bio: '',
        isOnline: true
      };
    }

    this.setSession(authResponse, userModel);
    return { authResponse, user: userModel };
  },

  /**
   * POST /auth/signup
   * Body: { username, password, name, email, gender ('boy'|'girl'), bio, photoUrl }
   * Returns: { jwt, userId }
   */
  async signUp(userData) {
    const { username, password, name, email, gender, bio, photoUrl } = userData;

    if (!username || !password) {
      throw new Error('Username and password are required.');
    }
    if (!name) {
      throw new Error('Name is required.');
    }
    if (!email) {
      throw new Error('Email is required.');
    }
    if (!gender || !['boy', 'girl'].includes(gender.toLowerCase())) {
      throw new Error('Gender must be "boy" or "girl".');
    }
    if (!photoUrl || !photoUrl.trim()) {
      throw new Error('Profile picture is required.');
    }

    const payload = {
      username: username.trim(),
      password,
      name: name.trim(),
      email: email.trim(),
      gender: gender.toLowerCase(),
      bio: bio ? bio.trim() : '',
      photoUrl: photoUrl.trim()
    };

    const response = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await handleApiResponse(response);
    const jwt = data.jwt;
    const userId = data.userId;

    const authResponse = { userId, jwt };
    const savedUser = {
      id: userId,
      username: data.username || username.trim(),
      name: payload.name,
      email: payload.email,
      gender: payload.gender,
      bio: payload.bio,
      photoUrl: payload.photoUrl,
      isOnline: true,
      interests: userData.interests || []
    };

    this.setSession(authResponse, savedUser);
    return { authResponse, user: savedUser };
  },

  /**
   * POST /auth/guest
   * Body: { name, gender }
   * Returns: { authResponse, user }
   */
  async loginAsGuest({ name, gender }) {
    if (!name || !name.trim()) {
      throw new Error('Please enter your name.');
    }
    if (!gender) {
      throw new Error('Please select your gender.');
    }

    const response = await fetch(`${BASE_URL}/auth/guest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ name: name.trim(), gender: gender.toLowerCase() })
    });

    const data = await handleApiResponse(response);
    const jwt = data.jwt;
    const userId = data.userId;

    const authResponse = { userId, jwt };

    let userModel = null;
    try {
      userModel = await this.getCurrentUser(jwt);
    } catch (e) {
      console.warn('[authService] getCurrentUser failed after guest login, using fallback', e);
      userModel = {
        id: userId,
        username: data.username || userId,
        name: data.name || name.trim(),
        gender: gender.toLowerCase(),
        photoUrl: gender.toLowerCase() === 'girl' ? '/userImages/girl1.png' : '/userImages/boy1.png',
        isGuest: true,
        isOnline: true
      };
    }

    this.setSession(authResponse, userModel);
    return { authResponse, user: userModel };
  },

  /**
   * POST /auth/guest/upgrade
   * Upgrades current guest session to permanent user account.
   */
  async upgradeGuest(upgradeData, token) {
    const activeToken = token || this.getToken();
    if (!activeToken) {
      throw new Error('No active guest session to upgrade.');
    }

    const { username, password, name, email, gender, bio, photoUrl } = upgradeData;
    if (!username || !password || !name || !email || !gender) {
      throw new Error('All mandatory fields must be filled.');
    }

    const response = await fetch(`${BASE_URL}/auth/guest/upgrade`, {
      method: 'POST',
      headers: getAuthHeaders(activeToken),
      body: JSON.stringify({
        username: username.trim(),
        password,
        name: name.trim(),
        email: email.trim(),
        gender: gender.toLowerCase(),
        bio: bio ? bio.trim() : '',
        photoUrl: photoUrl || ''
      })
    });

    const data = await handleApiResponse(response);
    const jwt = data.jwt;
    // The id is UNCHANGED by an upgrade - that is what keeps an in-flight chat alive.
    const userId = data.userId;

    const authResponse = { userId, jwt };

    let userModel = null;
    try {
      userModel = await this.getCurrentUser(jwt);
    } catch (e) {
      userModel = {
        id: userId,
        username: data.username || username.trim(),
        name: name.trim(),
        email: email.trim(),
        gender: gender.toLowerCase(),
        photoUrl: photoUrl || '',
        isGuest: false,
        isOnline: true
      };
    }

    this.setSession(authResponse, userModel);
    return { authResponse, user: userModel };
  },

  // ==========================================
  // User Profile & Discovery
  // ==========================================

  /**
   * GET /users/me
   */
  async getCurrentUser(token) {
    const response = await fetch(`${BASE_URL}/users/me`, {
      headers: getAuthHeaders(token)
    });
    const data = await handleApiResponse(response);
    return {
      // id = stable identity; username/name are display only.
      id: data.id,
      username: data.username,
      name: data.name || data.username,
      email: data.email || '',
      gender: data.gender || '',
      location: data.location || null,
      bio: data.bio || '',
      photoUrl: data.photoUrl || '',
      isOnline: data.online ?? data.isOnline ?? true,
      lastOnline: data.lastOnline || null,
      isGuest: Boolean(data.isGuest || data.guest)
    };
  },

  /**
   * GET /users/{userId}
   */
  async getUserById(userId, token) {
    const response = await fetch(`${BASE_URL}/users/${encodeURIComponent(userId)}`, {
      headers: getAuthHeaders(token)
    });
    return await handleApiResponse(response);
  },

  /**
   * GET /users?page=0&size=20
   */
  async getAllUsers(page = 0, size = 20, token) {
    const response = await fetch(`${BASE_URL}/users?page=${page}&size=${size}`, {
      headers: getAuthHeaders(token)
    });
    return await handleApiResponse(response);
  },

  /**
   * DELETE /users/{userId}
   */
  async deleteAccount(userId, token) {
    const response = await fetch(`${BASE_URL}/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(token)
    });
    return await handleApiResponse(response);
  },

  /**
   * PUT /users/fcm-token
   */
  async updateFcmToken(fcmToken, token) {
    const response = await fetch(`${BASE_URL}/users/fcm-token`, {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ fcmToken })
    });
    return await handleApiResponse(response);
  },

  /**
   * PUT /users/me
   */
  async updateProfile(profileData, token) {
    const response = await fetch(`${BASE_URL}/users/me`, {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify(profileData)
    });
    const data = await handleApiResponse(response);
    return {
      // id = stable identity; username/name are display only.
      id: data.id,
      username: data.username,
      name: data.name || data.username,
      email: data.email || '',
      gender: data.gender || '',
      location: data.location || null,
      bio: data.bio || '',
      photoUrl: data.photoUrl || '',
      isOnline: data.online ?? data.isOnline ?? true,
      lastOnline: data.lastOnline || null,
      isGuest: Boolean(data.isGuest || data.guest)
    };
  },

  /**
   * GET /users/profile-pictures(?gender=boy|girl)
   */
  async getProfilePictures(gender) {
    try {
      const url = gender
        ? `${BASE_URL}/users/profile-pictures?gender=${encodeURIComponent(gender)}`
        : `${BASE_URL}/users/profile-pictures`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      return await handleApiResponse(response);
    } catch (e) {
      console.warn('Could not fetch profile pictures:', e);
      return [];
    }
  },

  // ==========================================
  // Conversations Endpoints
  // ==========================================

  /**
   * POST /conversations
   * Body: { recipientId }  - the peer's stable user id, not their handle.
   * Returns: ConversationResponseDto
   */
  async createOrOpenConversation(recipientId, token) {
    const response = await fetch(`${BASE_URL}/conversations`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ recipientId })
    });
    return await handleApiResponse(response);
  },

  /**
   * GET /conversations/{id}
   */
  async getConversationById(conversationId, token) {
    const response = await fetch(`${BASE_URL}/conversations/${encodeURIComponent(conversationId)}`, {
      headers: getAuthHeaders(token)
    });
    return await handleApiResponse(response);
  },

  /**
   * GET /conversations?page=0&size=20
   * Returns Page<UserConversationDTO>
   */
  async getUserConversations(page = 0, size = 20, token) {
    try {
      const response = await fetch(`${BASE_URL}/conversations?page=${page}&size=${size}`, {
        headers: getAuthHeaders(token)
      });
      const data = await handleApiResponse(response);
      const list = Array.isArray(data?.content) ? data.content : (Array.isArray(data) ? data : []);
      return list.map(c => ({
        id: c.friendUserId || c.conversationId,
        conversationId: c.conversationId,
        friendUserId: c.friendUserId,
        friendUserName: c.friendUserName,
        name: c.friendUserName,
        username: c.friendId || '',
        photoUrl: c.photoUrl || '',
        avatar: c.photoUrl ? '' : '👤',
        lastMessage: c.lastMessage || 'Say hi!',
        lastMessageTime: c.lastMessageTime || '',
        isByYou: c.isByYou,
        messageStatus: c.messageStatus,
        messageType: c.messageType,
        unseenCount: c.unseenCount || 0
      }));
    } catch (e) {
      console.warn('[authService] getUserConversations failed:', e);
      return [];
    }
  },

  /**
   * GET /conversations/{conversationId}/messages?page=0&size=30
   */
  async fetchConversationMessages(conversationId, token, page = 0, size = 30) {
    if (!conversationId) return [];
    try {
      const myId = this.getUserId();
      const response = await fetch(`${BASE_URL}/conversations/${encodeURIComponent(conversationId)}/messages?page=${page}&size=${size}`, {
        headers: getAuthHeaders(token)
      });
      const data = await handleApiResponse(response);
      const list = Array.isArray(data?.content) ? data.content : (Array.isArray(data) ? data : []);

      // Messages arrive sorted newest to oldest from backend; reverse for chronological display
      const chronological = list.slice().reverse();

      return chronological.map(m => {
        const isMe = (m.senderId && String(m.senderId) === String(myId));
        const rawTime = m.timeStamp || m.timestamp || new Date().toISOString();
        return {
          id: m.id || 'msg_' + Math.random(),
          conversationId: m.conversationId || conversationId,
          senderId: m.senderId,
          sender: isMe ? 'me' : m.senderId,
          text: m.message || '',
          message: m.message || '',
          objectUri: m.objectUri || null,
          referredMessageId: m.referredMessageId || null,
          status: m.status || 'SENT',
          type: m.type || 'TEXT',
          time: new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: rawTime
        };
      });
    } catch (e) {
      console.warn('[authService] fetchConversationMessages failed:', e);
      return [];
    }
  },

  /**
   * POST /conversations/{conversationId}/seen?messageId=...
   */
  async markConversationSeen(conversationId, messageId, token) {
    const response = await fetch(`${BASE_URL}/conversations/${encodeURIComponent(conversationId)}/seen?messageId=${encodeURIComponent(messageId)}`, {
      method: 'POST',
      headers: getAuthHeaders(token)
    });
    return await handleApiResponse(response);
  },

  /**
   * PUT /conversations/{id}/end
   */
  async endConversation(conversationId, token) {
    const response = await fetch(`${BASE_URL}/conversations/${encodeURIComponent(conversationId)}/end`, {
      method: 'PUT',
      headers: getAuthHeaders(token)
    });
    return await handleApiResponse(response);
  },

  // ==========================================
  // Message Endpoints (REST Fallback)
  // ==========================================

  /**
   * POST /messages
   */
  async sendMessageRest(messageData, token) {
    const response = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(messageData)
    });
    return await handleApiResponse(response);
  },

  /**
   * DELETE /messages/{messageId}
   */
  async deleteMessageRest(messageId, token) {
    const response = await fetch(`${BASE_URL}/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(token)
    });
    return await handleApiResponse(response);
  },

  // ==========================================
  // Friendship Endpoints
  // ==========================================

  /**
   * GET /friendships?page=0&size=20
   * Returns: Page<FriendDto>
   */
  async getFriendsList(token, page = 0, size = 20) {
    try {
      const response = await fetch(`${BASE_URL}/friendships?page=${page}&size=${size}`, {
        headers: getAuthHeaders(token)
      });
      const data = await handleApiResponse(response);
      const content = Array.isArray(data?.content) ? data.content : (Array.isArray(data) ? data : []);
      return content.map(f => ({
        id: f.id,
        friendUserId: f.id,
        username: f.username,
        name: f.name || f.username,
        photoUrl: f.photoUrl || '',
        bio: f.bio || '',
        gender: f.gender || '',
        location: f.location || null,
        isOnline: f.online ?? f.isOnline ?? false,
        lastOnline: f.lastOnline || null,
        status: (f.online ?? f.isOnline) ? 'Online' : 'Offline'
      }));
    } catch (e) {
      console.warn('[authService] getFriendsList failed:', e);
      return [];
    }
  },

  /**
   * GET /friendships/requests/pending
   * Returns: List<FriendDto>
   */
  async getPendingFriendRequests(token) {
    try {
      const response = await fetch(`${BASE_URL}/friendships/requests/pending`, {
        headers: getAuthHeaders(token)
      });
      const list = await handleApiResponse(response);
      return Array.isArray(list) ? list.map(r => ({
        id: r.id,
        username: r.username,
        name: r.name || r.username,
        photoUrl: r.photoUrl || '',
        bio: r.bio || '',
        gender: r.gender || ''
      })) : [];
    } catch (e) {
      console.warn('[authService] getPendingFriendRequests failed:', e);
      return [];
    }
  },

  /**
   * GET /friendships/requests/sent
   * Returns: List<FriendDto>
   */
  async getSentFriendRequests(token) {
    try {
      const response = await fetch(`${BASE_URL}/friendships/requests/sent`, {
        headers: getAuthHeaders(token)
      });
      return await handleApiResponse(response);
    } catch (e) {
      console.warn('[authService] getSentFriendRequests failed:', e);
      return [];
    }
  },

  /**
   * POST /friendships/requests/{friendId}
   */
  async sendFriendRequest(friendId, token) {
    const response = await fetch(`${BASE_URL}/friendships/requests/${encodeURIComponent(friendId)}`, {
      method: 'POST',
      headers: getAuthHeaders(token)
    });
    return await handleApiResponse(response);
  },

  /**
   * PUT /friendships/requests/{friendId}/accept
   */
  async acceptFriendRequest(friendId, token) {
    const response = await fetch(`${BASE_URL}/friendships/requests/${encodeURIComponent(friendId)}/accept`, {
      method: 'PUT',
      headers: getAuthHeaders(token)
    });
    return await handleApiResponse(response);
  },

  /**
   * PUT /friendships/requests/{friendId}/reject
   */
  async rejectFriendRequest(friendId, token) {
    const response = await fetch(`${BASE_URL}/friendships/requests/${encodeURIComponent(friendId)}/reject`, {
      method: 'PUT',
      headers: getAuthHeaders(token)
    });
    return await handleApiResponse(response);
  },

  /**
   * DELETE /friendships/{friendId}
   */
  async removeFriendApi(friendId, token) {
    const response = await fetch(`${BASE_URL}/friendships/${encodeURIComponent(friendId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(token)
    });
    return await handleApiResponse(response);
  },

  async deleteFriendship(friendId, token) {
    return this.removeFriendApi(friendId, token);
  },

  async cancelFriendRequest(friendId, token) {
    return this.removeFriendApi(friendId, token);
  },

  /**
   * GET /friendships/status/{friendId}
   */
  async getFriendshipStatus(friendId, token) {
    const response = await fetch(`${BASE_URL}/friendships/status/${encodeURIComponent(friendId)}`, {
      headers: getAuthHeaders(token)
    });
    return await handleApiResponse(response);
  },

  // ==========================================
  // Session Verification
  // ==========================================

  /**
   * Validates active session on page load using GET /users/me.
   */
  async checkLandingAuth() {
    const token = this.getToken();
    const userId = this.getUserId();

    if (!token || !userId) {
      this.clearSession();
      return { isAuthenticated: false, user: null, jwt: null };
    }

    try {
      const user = await this.getCurrentUser(token);
      this.setSession({ userId: user.id, jwt: token }, user);
      return { isAuthenticated: true, user, jwt: token };
    } catch (err) {
      console.warn('Token verification failed:', err);
      this.clearSession();
      return { isAuthenticated: false, user: null, jwt: null };
    }
  }
};
