import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext();

export const AVATAR_LIST = [
  { icon: '👾', bg: '#8b5cf6', label: 'Alien' },
  { icon: '🦊', bg: '#f97316', label: 'Fox' },
  { icon: '🚀', bg: '#06b6d4', label: 'Rocket' },
  { icon: '⚡', bg: '#eab308', label: 'Flash' },
  { icon: '🐱', bg: '#ec4899', label: 'Cyber Cat' },
  { icon: '🐼', bg: '#10b981', label: 'Panda' },
  { icon: '💎', bg: '#3b82f6', label: 'Diamond' },
  { icon: '🔮', bg: '#a855f7', label: 'Mystic' }
];

export const INTEREST_TAGS = [
  'Gaming', 'Music', 'Tech', 'Anime', 'Movies',
  'Crypto', 'Fitness', 'Art', 'Travel', 'Reading', 'Chatting'
];

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [jwtToken, setJwtToken] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [profilePictures, setProfilePictures] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Friends list — starts from localStorage, synced from API when authenticated
  const [friends, setFriends] = useState(() => {
    const saved = localStorage.getItem('randomeet_friends');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  const [friendRequests, setFriendRequests] = useState([]);
  const [friendRequestsLoading, setFriendRequestsLoading] = useState(false);

  // On landing: verify stored session and fetch profile pictures from API
  useEffect(() => {
    let isMounted = true;
    async function initLandingAuth() {
      try {
        const [res, pics] = await Promise.all([
          authService.checkLandingAuth(),
          authService.getProfilePictures().catch(() => [])
        ]);
        console.log('Landing auth check result:', res, 'Profile pictures:', pics);
        if (isMounted) {
          setIsAuthenticated(res.isAuthenticated);
          setUser(res.user);
          setJwtToken(res.jwt || null);
          if (Array.isArray(pics) && pics.length > 0) {
            setProfilePictures(pics);
          }

          // Load real friends & requests from API if authenticated
          if (res.isAuthenticated && res.user?.id && res.jwt) {
            loadFriendsFromApi(res.user.id, res.jwt);
            loadFriendRequests(res.jwt);
          }
        }
      } catch (err) {
        if (isMounted) {
          setIsAuthenticated(false);
          setUser(null);
          setJwtToken(null);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    }

    initLandingAuth();
    return () => { isMounted = false; };
  }, []);

  // Persist friends to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('randomeet_friends', JSON.stringify(friends));
  }, [friends]);

  /**
   * Load friends & conversations from backend API.
   * Matches FriendRepository.kt: GET /conversations/my-conversations
   */
  const loadFriendsFromApi = async (userId = user?.id, token = jwtToken) => {
    if (!token) return;
    const conversations = await authService.getFriendConversations(token);
    if (conversations !== null) {
      setFriends(conversations);
      return;
    }

    // Fall back to GET /api/friends/{userId}
    if (userId) {
      const apiFriends = await authService.getFriends(userId, token);
      if (apiFriends !== null) {
        setFriends(apiFriends);
      }
    }
  };

  /**
   * Fetch pending friend requests from backend API.
   * Matches FriendRepository.kt: GET /friendships/to-be-accepted
   */
  const loadFriendRequests = async (token = jwtToken) => {
    if (!token) return [];
    setFriendRequestsLoading(true);
    try {
      const requests = await authService.getPendingFriendRequests(token);
      setFriendRequests(requests);
      return requests;
    } catch (e) {
      console.warn('Failed to load pending friend requests:', e);
      return [];
    } finally {
      setFriendRequestsLoading(false);
    }
  };

  /**
   * Send friend request to target friendId (userId or username).
   * Matches FriendRepository.kt: POST /friendships/request/{friendId}/send
   */
  const sendFriendRequest = async (friendId) => {
    const token = jwtToken || authService.getToken();
    if (!token || !friendId) {
      throw new Error('User token or friend ID missing.');
    }
    await authService.sendFriendRequest(friendId, token);
  };

  /**
   * Accept pending friend request.
   * Matches FriendRepository.kt: POST /friendships/request/{friendId}/accept
   */
  const acceptFriendRequest = async (friendId) => {
    const token = jwtToken || authService.getToken();
    if (!token || !friendId) return;
    await authService.acceptFriendRequest(friendId, token);
    setFriendRequests(prev => prev.filter(r => (r.id !== friendId && r.username !== friendId)));
    // Refresh friends list after accepting
    await loadFriendsFromApi(user?.id, token);
  };

  /**
   * Reject pending friend request.
   * Matches FriendRepository.kt: POST /friendships/request/{friendId}/reject
   */
  const rejectFriendRequest = async (friendId) => {
    const token = jwtToken || authService.getToken();
    if (!token || !friendId) return;
    await authService.rejectFriendRequest(friendId, token);
    setFriendRequests(prev => prev.filter(r => (r.id !== friendId && r.username !== friendId)));
  };

  /**
   * Login with username + password
   */
  const login = async (username, password) => {
    setAuthError('');
    try {
      const res = await authService.login(username, password);
      setIsAuthenticated(true);
      setUser(res.user);
      setJwtToken(res.authResponse.jwt);

      // Load real friends & requests from API after login
      if (res.user?.id && res.authResponse?.jwt) {
        loadFriendsFromApi(res.user.id, res.authResponse.jwt);
        loadFriendRequests(res.authResponse.jwt);
      }

      return res;
    } catch (err) {
      setAuthError(err.message || 'Login failed.');
      throw err;
    }
  };

  /**
   * Register a new account
   */
  const signUp = async (userData) => {
    setAuthError('');
    try {
      const res = await authService.signUp(userData);
      setIsAuthenticated(true);
      setUser(res.user);
      setJwtToken(res.authResponse.jwt);
      return res;
    } catch (err) {
      setAuthError(err.message || 'Sign up failed.');
      throw err;
    }
  };

  const logout = () => {
    authService.clearSession();
    setIsAuthenticated(false);
    setUser(null);
    setJwtToken(null);
    setAuthError('');
    setFriends([]);
    setFriendRequests([]);
  };

  const updateUserProfile = (updated) => {
    setUser(prev => {
      const nextUser = { ...prev, ...updated };
      authService.setSession({ userId: nextUser?.id, jwt: jwtToken }, nextUser);
      return nextUser;
    });
  };

  /**
   * Add friend — sends API friend request to friendId.
   */
  const addFriend = async (newFriend) => {
    const targetId = newFriend.id || newFriend.username || newFriend.friendUserId;
    if (targetId) {
      await sendFriendRequest(targetId);
    }
  };

  const removeFriend = async (friendId) => {
    setFriends(prev => prev.filter(f => f.id !== friendId && f.friendUserId !== friendId));

    // Also remove from API (best-effort)
    if (user?.id && jwtToken && friendId) {
      authService.removeFriendApi(user.id, jwtToken, friendId);
    }
  };

  const clearAuthError = () => setAuthError('');

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      jwtToken,
      user,
      profilePictures,
      authLoading,
      authError,
      clearAuthError,
      login,
      signUp,
      logout,
      updateUserProfile,
      soundEnabled,
      setSoundEnabled,
      friends,
      friendRequests,
      friendRequestsLoading,
      addFriend,
      sendFriendRequest,
      loadFriendRequests,
      acceptFriendRequest,
      rejectFriendRequest,
      removeFriend,
      loadFriendsFromApi
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
