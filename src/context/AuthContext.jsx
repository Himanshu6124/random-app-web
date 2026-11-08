import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { authService } from '../services/authService';
import { signInWithGooglePopup, ensureAnonymousFirebaseSession, isFirebaseConfigured } from '../services/firebaseClient';

const AuthContext = createContext();

// Safety-net poll only; live updates arrive on /user/queue/notifications.
const POLL_BASE_MS = 60000;
const POLL_JITTER_MS = 15000;

/** Replaces state only when the payload really changed, so consumers keep their identities. */
const replaceIfChanged = (setter, next) => {
  setter(prev => {
    try {
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    } catch (e) {
      return next;
    }
  });
};

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
  const [liveFriendRequest, setLiveFriendRequest] = useState(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalReason, setUpgradeModalReason] = useState('');
  const [pendingUpgradeAction, setPendingUpgradeAction] = useState(null);

  const isGuest = Boolean(user?.isGuest);

  const openUpgradeModal = useCallback((reason = '', pendingAction = null) => {
    setUpgradeModalReason(reason);
    setPendingUpgradeAction(pendingAction);
    setUpgradeModalOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModalOpen(false);
    setUpgradeModalReason('');
    setPendingUpgradeAction(null);
  }, []);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  // Bumped on logout so socket-owned state can drop the previous user's session
  const [sessionEpoch, setSessionEpoch] = useState(0);

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

      // Merge friends with conversation metadata. Keys are STABLE USER IDS.
      const mergedFriends = friendsList.map(f => {
        const conv = convMap.get(f.id);
        return {
          ...f,
          id: f.id,
          friendUserId: f.id,
          friendUserName: f.name || f.username,
          conversationId: conv ? conv.conversationId : null,
          lastMessage: conv?.lastMessage || 'Say hi!',
          lastMessageTime: conv?.lastMessageTime || '',
          unseenCount: conv?.unseenCount || 0
        };
      });

      // Add any conversations with users not in friends list
      conversations.forEach(c => {
        if (!mergedFriends.some(f => f.id === c.friendUserId)) {
          mergedFriends.push({
            id: c.friendUserId,
            username: c.username || '',
            friendUserId: c.friendUserId,
            name: c.friendUserName || c.username || 'Unknown',
            friendUserName: c.friendUserName || c.username || 'Unknown',
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

      replaceIfChanged(setFriends, mergedFriends);
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
      replaceIfChanged(setFriendRequests, requests);
      return requests;
    } catch (e) {
      console.warn('[AuthContext] Failed to load pending friend requests:', e);
      return [];
    } finally {
      setFriendRequestsLoading(false);
    }
  }, [jwtToken]);

  /**
   * Applies a presence event pushed over the socket to the friends list, so a
   * friend does not stay "Offline" until the next poll.
   */
  const applyFriendPresence = useCallback((userId, online) => {
    if (!userId) return;
    setFriends(prev => {
      let changed = false;
      const next = prev.map(f => {
        const key = f.id || f.friendUserId;
        if (key !== userId || f.isOnline === online) return f;
        changed = true;
        return { ...f, isOnline: online, status: online ? 'Online' : 'Offline' };
      });
      return changed ? next : prev;
    });
  }, []);

  // Safety-net social sync. Live updates come over the socket; this only covers
  // what a missed frame would lose, so it is slow, jittered and visible-tab only.
  useEffect(() => {
    if (!isAuthenticated || !jwtToken || isGuest) return;

    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) return;
      const delay = POLL_BASE_MS + Math.floor(Math.random() * POLL_JITTER_MS);
      pollTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          loadFriendsFromApi(jwtToken);
          loadFriendRequests(jwtToken);
        }
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
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

          // A guest reloading the page also re-ensures their anonymous Firebase identity
          // (CONTRACT B1-5). Quiet no-op when Firebase is unconfigured.
          if (res.isAuthenticated && res.user?.isGuest) {
            ensureAnonymousFirebaseSession();
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


  const sendFriendRequest = useCallback(async (targetUserId) => {
    const token = jwtToken || authService.getToken();
    if (!token || !targetUserId) {
      throw new Error('User token or target user id missing.');
    }
    try {
      await authService.sendFriendRequest(targetUserId, token);
    } catch (err) {
      if (err.status === 409 || (err.message && err.message.toLowerCase().includes('already exists'))) {
        // Request or friendship already exists on server, treat gracefully
        return;
      }
      throw err;
    }
    await loadFriendRequests(token);
  }, [jwtToken, loadFriendRequests]);

  const acceptFriendRequest = useCallback(async (targetUserId) => {
    const token = jwtToken || authService.getToken();
    if (!token || !targetUserId) return;
    await authService.acceptFriendRequest(targetUserId, token);
    setFriendRequests(prev => prev.filter(r => r.id !== targetUserId));
    await loadFriendsFromApi(token);
  }, [jwtToken, loadFriendsFromApi]);

  const rejectFriendRequest = useCallback(async (targetUserId) => {
    const token = jwtToken || authService.getToken();
    if (!token || !targetUserId) return;
    await authService.rejectFriendRequest(targetUserId, token);
    setFriendRequests(prev => prev.filter(r => r.id !== targetUserId));
  }, [jwtToken]);

  const cancelFriendRequest = useCallback(async (targetUserId) => {
    const token = jwtToken || authService.getToken();
    if (!token || !targetUserId) return;
    try {
      await authService.removeFriendApi(targetUserId, token);
      await loadFriendRequests(token);
    } catch (e) {
      console.warn('Failed to cancel friend request:', e);
    }
  }, [jwtToken, loadFriendRequests]);

  const removeFriend = useCallback(async (friendId) => {
    const token = jwtToken || authService.getToken();
    setFriends(prev => prev.filter(f => f.id !== friendId));

    if (token && friendId) {
      try {
        await authService.removeFriendApi(friendId, token);
        await loadFriendsFromApi(token);
      } catch (e) {
        console.warn('Failed to delete friendship on server:', e);
      }
    }
  }, [jwtToken, loadFriendsFromApi]);

  const addFriend = useCallback(async (newFriend) => {
    const targetUserId = newFriend.id || newFriend.friendUserId;
    if (targetUserId) {
      await sendFriendRequest(targetUserId);
    }
  }, [sendFriendRequest]);

  const login = useCallback(async (username, password) => {
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
      // One neutral message: distinguishing "no such user" from "bad password"
      // lets anyone enumerate usernames.
      setAuthError(err.status ? 'Incorrect username or password.' : 'Unable to sign in right now. Please try again.');
      throw err;
    }
  }, [loadFriendsFromApi, loadFriendRequests]);

  const signUp = useCallback(async (userData) => {
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
  }, [loadFriendsFromApi, loadFriendRequests]);

  const loginAsGuest = useCallback(async ({ name, gender }) => {
    setAuthError('');
    try {
      const res = await authService.loginAsGuest({ name, gender });
      setIsAuthenticated(true);
      setUser(res.user);
      setJwtToken(res.authResponse.jwt);
      setFriends([]);
      setFriendRequests([]);
      // Guests get an anonymous Firebase identity so they can upload chat media too
      // (CONTRACT 6). Quiet no-op when Firebase is unconfigured.
      ensureAnonymousFirebaseSession();
      return res;
    } catch (err) {
      setAuthError(err.message || 'Guest entry failed.');
      throw err;
    }
  }, []);

  const upgradeGuestAccount = useCallback(async (data) => {
    setAuthError('');
    try {
      const res = await authService.upgradeGuest(data, jwtToken);
      setUser(res.user);
      setJwtToken(res.authResponse.jwt);
      const actionToExecute = pendingUpgradeAction;
      closeUpgradeModal();
      loadFriendsFromApi(res.authResponse.jwt);
      loadFriendRequests(res.authResponse.jwt);

      if (actionToExecute) {
        if (actionToExecute.action === 'ACCEPT_FRIEND' && actionToExecute.targetUserId) {
          try {
            await authService.acceptFriendRequest(actionToExecute.targetUserId, res.authResponse.jwt);
            loadFriendsFromApi(res.authResponse.jwt);
          } catch (err) {
            console.warn('[AuthContext] Error auto-accepting friend after upgrade:', err);
          }
        } else if (actionToExecute.action === 'SEND_FRIEND' && actionToExecute.targetUserId) {
          try {
            await authService.sendFriendRequest(actionToExecute.targetUserId, res.authResponse.jwt);
            loadFriendRequests(res.authResponse.jwt);
          } catch (err) {
            console.warn('[AuthContext] Error auto-sending friend request after upgrade:', err);
          }
        }
      }

      return res;
    } catch (err) {
      setAuthError(err.message || 'Upgrade failed.');
      throw err;
    }
  }, [jwtToken, pendingUpgradeAction, closeUpgradeModal, loadFriendsFromApi, loadFriendRequests]);

  const requestLogout = useCallback(() => setShowLogoutModal(true), []);
  const cancelLogout = useCallback(() => setShowLogoutModal(false), []);

  // ==========================================
  // Google sign-in flows (Stage B1)
  // ==========================================

  /** Applies a FirebaseLoginResponseDto that carries a jwt to local state. */
  const applyFirebaseSession = useCallback((res) => {
    const authResponse = { jwt: res.jwt, userId: res.userId };
    const nextUser = {
      id: res.userId,
      username: res.username,
      name: res.name || res.username,
      photoUrl: res.photoUrl || (res.gender === 'girl' ? '/userImages/girl1.png' : '/userImages/boy1.png'),
      gender: res.gender || 'boy',
      isGuest: Boolean(res.isGuest)
    };
    authService.setSession(authResponse, nextUser);
    setIsAuthenticated(true);
    setUser(nextUser);
    setJwtToken(res.jwt);
    loadFriendsFromApi(res.jwt);
    loadFriendRequests(res.jwt);
    return res;
  }, [loadFriendRequests, loadFriendsFromApi]);

  /**
   * Google popup -> POST /auth/firebase. When the Google user is brand-new the backend
   * answers NEEDS_USERNAME and the UI shows the username-claim step (which calls
   * completeGoogleSignup). A guest who wants to upgrade mid-chat calls linkGoogleAccount
   * instead, which keeps the current chat alive.
   */
  const signInWithGoogle = useCallback(async () => {
    setAuthError('');
    if (!isFirebaseConfigured()) {
      throw new Error('Google sign-in is not configured yet. Please continue as a guest for now.');
    }
    try {
      const fbUser = await signInWithGooglePopup();
      const idToken = await fbUser.getIdToken();
      const res = await authService.firebaseSignIn(idToken);
      if (res.status === 'NEEDS_USERNAME') {
        return res; // caller renders the username-claim step
      }
      return applyFirebaseSession(res);
    } catch (err) {
      setAuthError(err.message || 'Google sign-in failed.');
      throw err;
    }
  }, [applyFirebaseSession]);

  /** Step 2 for brand-new Google users: create the account with the claimed username. */
  const completeGoogleSignup = useCallback(async ({ registrationToken, username, name, gender, photoUrl }) => {
    setAuthError('');
    try {
      const res = await authService.firebaseCompleteSignup(registrationToken, { username, name, gender, photoUrl });
      return applyFirebaseSession(res);
    } catch (err) {
      setAuthError(err.message || 'Account creation failed.');
      throw err;
    }
  }, [applyFirebaseSession]);

  /**
   * A guest links a Google account mid-chat. The backend updates the guest's row IN PLACE
   * (same stable id), so the active random chat, its history and the socket room all
   * survive the JWT swap.
   */
  const linkGoogleAccount = useCallback(async (idToken, profile = {}) => {
    setAuthError('');
    try {
      const token = jwtToken || authService.getToken();
      const res = await authService.firebaseLinkAccount(idToken, profile, token);

      // Same user id, new JWT: persist the swap. The socket effect reconnects with the
      // same principal, so room membership still resolves and messages keep flowing.
      const nextUser = {
        ...(user || {}),
        id: res.userId,
        username: res.username || profile.username || user?.username,
        name: res.name || profile.name || user?.name || res.username,
        gender: profile.gender || user?.gender || 'boy',
        photoUrl: res.photoUrl || profile.photoUrl || user?.photoUrl,
        isGuest: false
      };
      authService.setSession({ jwt: res.jwt, userId: res.userId }, nextUser);
      setUser(nextUser);
      setJwtToken(res.jwt);
      loadFriendsFromApi(res.jwt);
      loadFriendRequests(res.jwt);
      return res;
    } catch (err) {
      setAuthError(err.message || 'Google account linking failed.');
      throw err;
    }
  }, [jwtToken, user, loadFriendsFromApi, loadFriendRequests]);

  const performLogout = useCallback(() => {
    setShowLogoutModal(false);
    authService.clearSession();
    // The next user on this tab must not inherit the previous one's cached chats
    try {
      localStorage.removeItem('randomeet_dms');
      localStorage.removeItem('randomeet_friends');
    } catch (e) {}
    setIsAuthenticated(false);
    setUser(null);
    setJwtToken(null);
    setAuthError('');
    setFriends([]);
    setFriendRequests([]);
    setLiveFriendRequest(null);
    setSessionEpoch(prev => prev + 1);
  }, []);

  const logout = useCallback(() => requestLogout(), [requestLogout]);

  const dismissLiveFriendRequest = useCallback(() => setLiveFriendRequest(null), []);

  const acceptLiveFriendRequest = useCallback(async () => {
    if (!liveFriendRequest) return;
    const reqUserId = liveFriendRequest.id || liveFriendRequest.friendUserId;
    const senderName = liveFriendRequest.name || liveFriendRequest.senderName || liveFriendRequest.username || 'Someone';
    if (isGuest) {
      setLiveFriendRequest(null);
      openUpgradeModal(`create an account to accept friend request from ${senderName}`, {
        action: 'ACCEPT_FRIEND',
        targetUserId: reqUserId
      });
      return;
    }
    setLiveFriendRequest(null);
    if (reqUserId) {
      await acceptFriendRequest(reqUserId);
    }
  }, [liveFriendRequest, isGuest, openUpgradeModal, acceptFriendRequest]);

  const updateUserProfile = useCallback(async (updated) => {
    try {
      const token = jwtToken || authService.getToken();
      if (token) {
        const saved = await authService.updateProfile(updated, token);
        setUser(prev => {
          const nextUser = { ...prev, ...saved };
          authService.setSession({ userId: nextUser?.id, jwt: token }, nextUser);
          return nextUser;
        });
        return saved;
      }
    } catch (e) {
      console.warn('[AuthContext] Remote profile update failed:', e);
      throw e;
    }
  }, [jwtToken]);

  const clearAuthError = useCallback(() => setAuthError(''), []);

  const value = useMemo(() => ({
    isAuthenticated,
    isGuest,
    jwtToken,
    user,
    sessionEpoch,
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
    signInWithGoogle,
    completeGoogleSignup,
    linkGoogleAccount,
    firebaseConfigured: isFirebaseConfigured(),
    upgradeModalOpen,
    upgradeModalReason,
    pendingUpgradeAction,
    openUpgradeModal,
    closeUpgradeModal,
    logout,
    updateUserProfile,
    soundEnabled,
    setSoundEnabled,
    friends,
    friendRequests,
    friendRequestsLoading,
    liveFriendRequest,
    setLiveFriendRequest,
    dismissLiveFriendRequest,
    acceptLiveFriendRequest,
    applyFriendPresence,
    addFriend,
    sendFriendRequest,
    cancelFriendRequest,
    loadFriendRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    loadFriendsFromApi
  }), [
    isAuthenticated, isGuest, jwtToken, user, sessionEpoch, profilePictures, authLoading,
    authError, showLogoutModal, requestLogout, cancelLogout, performLogout, clearAuthError,
    login, signUp, loginAsGuest, upgradeGuestAccount, signInWithGoogle, completeGoogleSignup,
    linkGoogleAccount, upgradeModalOpen, upgradeModalReason,
    pendingUpgradeAction, openUpgradeModal, closeUpgradeModal, logout, updateUserProfile,
    soundEnabled, friends, friendRequests, friendRequestsLoading, liveFriendRequest,
    dismissLiveFriendRequest, acceptLiveFriendRequest, applyFriendPresence, addFriend,
    sendFriendRequest, cancelFriendRequest, loadFriendRequests, acceptFriendRequest,
    rejectFriendRequest, removeFriend, loadFriendsFromApi
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
