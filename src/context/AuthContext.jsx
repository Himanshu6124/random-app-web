import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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

  // Friends & conversations lists
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friendRequestsLoading, setFriendRequestsLoading] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalReason, setUpgradeModalReason] = useState('');

  const isGuest = Boolean(user?.isGuest);

  const openUpgradeModal = (reason = '') => {
    setUpgradeModalReason(reason);
    setUpgradeModalOpen(true);
  };

  const closeUpgradeModal = () => {
    setUpgradeModalOpen(false);
    setUpgradeModalReason('');
  };
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const pollTimerRef = useRef(null);

  /**
   * Load friends and conversations from backend API.
   */
  const loadFriendsFromApi = useCallback(async (token = jwtToken) => {
    const activeToken = token || authService.getToken();
    if (!activeToken) return;

    try {
      const [friendsList, conversations] = await Promise.all([
        authService.getFriendsList(activeToken).catch(() => []),
        authService.getUserConversations(0, 50, activeToken).catch(() => [])
      ]);

      const convMap = new Map();
      conversations.forEach(c => {
        if (c.friendUserId) {
          convMap.set(c.friendUserId, c);
        }
      });

      // Merge friends with conversation metadata
      const mergedFriends = friendsList.map(f => {
        const conv = convMap.get(f.username);
        return {
          ...f,
          id: f.username,
          friendUserId: f.username,
          friendUserName: f.name || f.username,
          conversationId: conv ? conv.conversationId : null,
          lastMessage: conv?.lastMessage || 'Say hi!',
          lastMessageTime: conv?.lastMessageTime || '',
          unseenCount: conv?.unseenCount || 0
        };
      });

      // Add any conversations with users not in friends list
      conversations.forEach(c => {
        if (!mergedFriends.some(f => f.username === c.friendUserId)) {
          mergedFriends.push({
            id: c.friendUserId,
            username: c.friendUserId,
            friendUserId: c.friendUserId,
            name: c.friendUserName || c.friendUserId,
            friendUserName: c.friendUserName || c.friendUserId,
            photoUrl: c.photoUrl || '',
            conversationId: c.conversationId,
            lastMessage: c.lastMessage || 'Say hi!',
            lastMessageTime: c.lastMessageTime || '',
            unseenCount: c.unseenCount || 0,
            isOnline: false,
            status: 'Offline'
          });
        }
      });

      setFriends(mergedFriends);
      localStorage.setItem('randomeet_friends', JSON.stringify(mergedFriends));
    } catch (e) {
      console.warn('[AuthContext] loadFriendsFromApi error:', e);
    }
  }, [jwtToken]);

  /**
   * Fetch pending friend requests.
   */
  const loadFriendRequests = useCallback(async (token = jwtToken) => {
    const activeToken = token || authService.getToken();
    if (!activeToken) return [];
    setFriendRequestsLoading(true);
    try {
      const requests = await authService.getPendingFriendRequests(activeToken);
      setFriendRequests(requests);
      return requests;
    } catch (e) {
      console.warn('[AuthContext] Failed to load pending friend requests:', e);
      return [];
    } finally {
      setFriendRequestsLoading(false);
    }
  }, [jwtToken]);

  // Periodic polling for social sync (requests, friends list)
  useEffect(() => {
    if (!isAuthenticated || !jwtToken || isGuest) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    pollTimerRef.current = setInterval(() => {
      loadFriendsFromApi(jwtToken);
      loadFriendRequests(jwtToken);
    }, 4000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isAuthenticated, jwtToken, isGuest, loadFriendsFromApi, loadFriendRequests]);

  // Initial Auth check on mount
  useEffect(() => {
    let isMounted = true;
    async function initLandingAuth() {
      try {
        const [res, pics] = await Promise.all([
          authService.checkLandingAuth(),
          authService.getProfilePictures().catch(() => [])
        ]);

        if (isMounted) {
          setIsAuthenticated(res.isAuthenticated);
          setUser(res.user);
          setJwtToken(res.jwt || null);

          if (Array.isArray(pics) && pics.length > 0) {
            setProfilePictures(pics);
          }

          if (res.isAuthenticated && res.jwt && !res.user?.isGuest) {
            loadFriendsFromApi(res.jwt);
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
  }, [loadFriendsFromApi, loadFriendRequests]);

  const sendFriendRequest = async (targetUsername) => {
    const token = jwtToken || authService.getToken();
    if (!token || !targetUsername) {
      throw new Error('User token or target username missing.');
    }
    try {
      await authService.sendFriendRequest(targetUsername, token);
    } catch (err) {
      if (err.status === 409 || (err.message && err.message.toLowerCase().includes('already exists'))) {
        // Request or friendship already exists on server, treat gracefully
        return;
      }
      throw err;
    }
    await loadFriendRequests(token);
  };

  const acceptFriendRequest = async (targetUsername) => {
    const token = jwtToken || authService.getToken();
    if (!token || !targetUsername) return;
    await authService.acceptFriendRequest(targetUsername, token);
    setFriendRequests(prev => prev.filter(r => r.username !== targetUsername && r.id !== targetUsername));
    await loadFriendsFromApi(token);
  };

  const rejectFriendRequest = async (targetUsername) => {
    const token = jwtToken || authService.getToken();
    if (!token || !targetUsername) return;
    await authService.rejectFriendRequest(targetUsername, token);
    setFriendRequests(prev => prev.filter(r => r.username !== targetUsername && r.id !== targetUsername));
  };

  const removeFriend = async (friendUsername) => {
    const token = jwtToken || authService.getToken();
    setFriends(prev => prev.filter(f => f.username !== friendUsername && f.id !== friendUsername));

    if (token && friendUsername) {
      try {
        await authService.removeFriendApi(friendUsername, token);
        await loadFriendsFromApi(token);
      } catch (e) {
        console.warn('Failed to delete friendship on server:', e);
      }
    }
  };

  const addFriend = async (newFriend) => {
    const targetUsername = newFriend.username || newFriend.friendUserId || newFriend.id;
    if (targetUsername) {
      await sendFriendRequest(targetUsername);
    }
  };

  const login = async (username, password) => {
    setAuthError('');
    try {
      const res = await authService.login(username, password);
      setIsAuthenticated(true);
      setUser(res.user);
      setJwtToken(res.authResponse.jwt);

      loadFriendsFromApi(res.authResponse.jwt);
      loadFriendRequests(res.authResponse.jwt);
      return res;
    } catch (err) {
      setAuthError(err.message || 'Login failed.');
      throw err;
    }
  };

  const signUp = async (userData) => {
    setAuthError('');
    try {
      const res = await authService.signUp(userData);
      setIsAuthenticated(true);
      setUser(res.user);
      setJwtToken(res.authResponse.jwt);

      loadFriendsFromApi(res.authResponse.jwt);
      loadFriendRequests(res.authResponse.jwt);
      return res;
    } catch (err) {
      setAuthError(err.message || 'Sign up failed.');
      throw err;
    }
  };

  const loginAsGuest = async ({ name, gender }) => {
    setAuthError('');
    try {
      const res = await authService.loginAsGuest({ name, gender });
      setIsAuthenticated(true);
      setUser(res.user);
      setJwtToken(res.authResponse.jwt);
      setFriends([]);
      setFriendRequests([]);
      return res;
    } catch (err) {
      setAuthError(err.message || 'Guest entry failed.');
      throw err;
    }
  };

  const upgradeGuestAccount = async (data) => {
    setAuthError('');
    try {
      const res = await authService.upgradeGuest(data, jwtToken);
      setUser(res.user);
      setJwtToken(res.authResponse.jwt);
      closeUpgradeModal();
      loadFriendsFromApi(res.authResponse.jwt);
      loadFriendRequests(res.authResponse.jwt);
      return res;
    } catch (err) {
      setAuthError(err.message || 'Upgrade failed.');
      throw err;
    }
  };

  const requestLogout = () => setShowLogoutModal(true);
  const cancelLogout = () => setShowLogoutModal(false);

  const performLogout = () => {
    setShowLogoutModal(false);
    authService.clearSession();
    setIsAuthenticated(false);
    setUser(null);
    setJwtToken(null);
    setAuthError('');
    setFriends([]);
    setFriendRequests([]);
  };

  const logout = () => requestLogout();

  const updateUserProfile = (updated) => {
    setUser(prev => {
      const nextUser = { ...prev, ...updated };
      authService.setSession({ userId: nextUser?.username || nextUser?.id, jwt: jwtToken }, nextUser);
      return nextUser;
    });
  };

  const clearAuthError = () => setAuthError('');

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isGuest,
      jwtToken,
      user,
      profilePictures,
      authLoading,
      authError,
      showLogoutModal,
      requestLogout,
      cancelLogout,
      performLogout,
      clearAuthError,
      login,
      signUp,
      loginAsGuest,
      upgradeGuestAccount,
      upgradeModalOpen,
      upgradeModalReason,
      openUpgradeModal,
      closeUpgradeModal,
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
