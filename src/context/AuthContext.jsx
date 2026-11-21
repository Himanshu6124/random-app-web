import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { authService, isAuthRejection } from '../services/authService';
import { disablePushNotifications } from '../services/pushClient';
import { feedback } from '../mobile/feedback';
import { notify, pageInView } from '../services/notify';
import {
  startGoogleSignIn, consumeGoogleRedirect, ensureAnonymousFirebaseSession, isFirebaseConfigured
} from '../services/firebaseClient';
import { isBotUserId, setBotRelation } from '../services/botPeers';

const AuthContext = createContext();

/**
 * Sends a friend request as `viewerId`. A request to a bot is recorded on this device only and
 * never reaches the server (see services/botPeers).
 */
async function requestFriendship(targetUserId, jwt, viewerId) {
  if (isBotUserId(targetUserId)) {
    setBotRelation(viewerId, targetUserId, 'PENDING_SENT');
    return;
  }
  await authService.sendFriendRequest(targetUserId, jwt);
}

// Backend tokens live 24h; renew well inside that so a tab left open never runs out.
const TOKEN_REFRESH_MS = 6 * 60 * 60 * 1000;

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
  { icon: '👾', bg: '#6f55a8', label: 'Alien' },
  { icon: '🦊', bg: '#a8543a', label: 'Fox' },
  { icon: '🚀', bg: '#3f63b8', label: 'Rocket' },
  { icon: '⚡', bg: '#9a6a1c', label: 'Flash' },
  { icon: '🐱', bg: '#a64d66', label: 'Cyber Cat' },
  { icon: '🐼', bg: '#2b7d59', label: 'Panda' },
  { icon: '💎', bg: '#3f6f80', label: 'Diamond' },
  { icon: '🔮', bg: '#584a9e', label: 'Mystic' }
];

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [jwtToken, setJwtToken] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Friends & conversations lists
  const [friends, setFriends] = useState([]);
  const friendsRef = useRef([]);
  useEffect(() => { friendsRef.current = friends; }, [friends]);
  const [friendRequests, setFriendRequests] = useState([]);
  const friendRequestsRef = useRef([]);
  useEffect(() => { friendRequestsRef.current = friendRequests; }, [friendRequests]);
  const [friendRequestsLoading, setFriendRequestsLoading] = useState(false);
  const [liveFriendRequest, setLiveFriendRequest] = useState(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalReason, setUpgradeModalReason] = useState('');
  const [pendingUpgradeAction, setPendingUpgradeAction] = useState(null);
  const pendingUpgradeActionRef = useRef(null);
  // Results of a Google redirect sign-in (installed iOS app), picked up after the reload:
  // login screen -> { claim } or { error }; guest upgrade -> { idToken, email, displayName }.
  const [googleRedirectLogin, setGoogleRedirectLogin] = useState(null);
  const [googleRedirectUpgrade, setGoogleRedirectUpgrade] = useState(null);
  const clearGoogleRedirectLogin = useCallback(() => setGoogleRedirectLogin(null), []);
  const clearGoogleRedirectUpgrade = useCallback(() => setGoogleRedirectUpgrade(null), []);
  // applyFirebaseSession is declared further down; the mount effect reaches it through this ref.
  const applyFirebaseSessionRef = useRef(null);
  const performLogoutRef = useRef(null);

  const isGuest = Boolean(user?.isGuest);

  const openUpgradeModal = useCallback((reason = '', pendingAction = null) => {
    setUpgradeModalReason(reason);
    setPendingUpgradeAction(pendingAction);
    pendingUpgradeActionRef.current = pendingAction;
    setUpgradeModalOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModalOpen(false);
    setUpgradeModalReason('');
    setPendingUpgradeAction(null);
    pendingUpgradeActionRef.current = null;
  }, []);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  // Bumped on logout so socket-owned state can drop the previous user's session
  const [sessionEpoch, setSessionEpoch] = useState(0);

  // Tracks currently open friend direct message conversation to avoid unread counting while viewing
  const [activeDmFriendId, setActiveDmFriendId] = useState(null);
  const activeDmFriendIdRef = useRef(activeDmFriendId);
  useEffect(() => { activeDmFriendIdRef.current = activeDmFriendId; }, [activeDmFriendId]);

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
  const applyFriendPresence = useCallback((userId, online, lastSeen = null) => {
    if (!userId) return;
    setFriends(prev => {
      let changed = false;
      const next = prev.map(f => {
        const key = f.id || f.friendUserId;
        if (key !== userId || f.isOnline === online) return f;
        changed = true;
        // Going online also counts as "seen now", so the recent-first sort stays right.
        const seen = online ? new Date().toISOString() : (lastSeen || new Date().toISOString());
        return { ...f, isOnline: online, status: online ? 'Online' : 'Offline', lastOnline: seen };
      });
      return changed ? next : prev;
    });
  }, []);

  /**
   * Resets unread messages badge for a specific friend upon opening their conversation.
   */
  const markFriendMessagesSeen = useCallback((friendUserId) => {
    if (!friendUserId) return;
    setFriends(prev => prev.map(f => {
      const key = f.id || f.friendUserId;
      if (key === friendUserId && (f.unseenCount || 0) > 0) {
        return { ...f, unseenCount: 0 };
      }
      return f;
    }));
  }, []);

  /**
   * Handles incoming direct message from notifications queue or active room.
   */
  const handleIncomingDirectMessage = useCallback((msg) => {
    if (!msg) return;
    const senderId = msg.senderId;
    if (!senderId || senderId === user?.id) return;

    const isViewingThisFriend = activeDmFriendIdRef.current === senderId;
    feedback(isViewingThisFriend ? 'receive' : 'notify');
    const preview = msg.type === 'IMAGE' ? '📷 Photo' : (msg.text || msg.message || 'Say hi!');
    if (!isViewingThisFriend || !pageInView()) {
      const sender = friendsRef.current.find(f => (f.id || f.friendUserId) === senderId);
      notify({
        key: `dm-${senderId}`,
        kind: 'message',
        title: sender?.name || msg.senderName || 'New message',
        body: preview,
        icon: sender?.photoUrl || '',
        target: { tab: 'friends', friendId: senderId }
      });
    }
    const rawTime = msg.timestamp || msg.timeStamp || new Date().toISOString();

    setFriends(prev => {
      let matched = false;
      const next = prev.map(f => {
        const key = f.id || f.friendUserId;
        if (key === senderId) {
          matched = true;
          const currentUnseen = f.unseenCount || 0;
          return {
            ...f,
            conversationId: f.conversationId || msg.conversationId,
            lastMessage: preview,
            lastMessageTime: rawTime,
            unseenCount: isViewingThisFriend ? 0 : currentUnseen + 1
          };
        }
        return f;
      });

      if (!matched) {
        loadFriendsFromApi();
        return prev;
      }
      return next;
    });
  }, [user?.id, loadFriendsFromApi]);

  const totalUnreadFriendsCount = useMemo(() => {
    return friends.reduce((sum, f) => sum + (f.unseenCount || 0), 0);
  }, [friends]);

  // Safety-net social sync. Live updates come over the socket; this only covers
  // what a missed frame would lose, so it is slow, jittered and visible-tab only.
  useEffect(() => {
    if (!isAuthenticated || !jwtToken) return;

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
  }, [isAuthenticated, jwtToken, loadFriendsFromApi, loadFriendRequests]);

  // Sliding session: renew the token every few hours, and when a tab or installed app comes
  // back after a long time hidden (timers barely run there). Only a real 401/403 logs out.
  const lastRefreshRef = useRef(Date.now());
  const refreshInFlightRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated) return;
    lastRefreshRef.current = Date.now();

    let cancelled = false;
    const renew = async () => {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      try {
        const fresh = await authService.refreshToken();
        if (cancelled) return;
        lastRefreshRef.current = Date.now();
        setJwtToken(fresh);
      } catch (err) {
        if (!cancelled && isAuthRejection(err)) performLogoutRef.current?.();
        // Network / server errors: keep the session and try again on the next tick.
      } finally {
        refreshInFlightRef.current = false;
      }
    };

    const timer = setInterval(renew, TOKEN_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible'
          && Date.now() - lastRefreshRef.current >= TOKEN_REFRESH_MS) {
        renew();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated]);

  // Initial Auth check on mount
  useEffect(() => {
    let isMounted = true;
    async function initLandingAuth() {
      try {
        const res = await authService.checkLandingAuth();

        if (isMounted) {
          setIsAuthenticated(res.isAuthenticated);
          setUser(res.user);
          setJwtToken(res.jwt || null);

          if (res.isAuthenticated && res.jwt) {
            loadFriendsFromApi(res.jwt);
            loadFriendRequests(res.jwt);
          }

          // Back from a Google redirect (installed iOS app): resume that sign-in. This must run
          // before the anonymous session below, which would otherwise replace the Google user.
          let redirect = null;
          try {
            redirect = await consumeGoogleRedirect();
          } catch (err) {
            if (isMounted) setGoogleRedirectLogin({ error: err?.message || 'Google sign-in failed. Please try again.' });
          }
          if (isMounted && redirect?.user) {
            try {
              const idToken = await redirect.user.getIdToken();
              if (redirect.purpose === 'upgrade' && res.isAuthenticated && res.user?.isGuest) {
                // The upgrade modal finishes linking with the guest's restored session.
                setGoogleRedirectUpgrade({
                  idToken,
                  email: redirect.user.email,
                  displayName: redirect.user.displayName
                });
                openUpgradeModal(redirect.context?.reason || '', redirect.context?.pendingAction || null);
              } else {
                const signIn = await authService.firebaseSignIn(idToken);
                if (!isMounted) return;
                if (signIn.status === 'NEEDS_USERNAME') {
                  setGoogleRedirectLogin({ claim: signIn });
                } else {
                  applyFirebaseSessionRef.current?.(signIn);
                }
              }
            } catch (err) {
              if (isMounted) setGoogleRedirectLogin({ error: err?.message || 'Google sign-in failed. Please try again.' });
            }
          }

          // A guest reloading the page also re-ensures their anonymous Firebase identity
          // (CONTRACT B1-5). Quiet no-op when Firebase is unconfigured.
          if (res.isAuthenticated && res.user?.isGuest && !redirect?.user) {
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
    // Mount only. checkLandingAuth() renews the token and setJwtToken() gives loadFriendsFromApi /
    // loadFriendRequests new identities, so listing them here re-ran this effect after every renewal:
    // an endless refresh + /users/me loop on phones, where each round trip lands in a new second and
    // so mints a different token. Both loaders get res.jwt explicitly; openUpgradeModal is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  /** message: optional short note shown to the receiver with the request. */
  const sendFriendRequest = useCallback(async (targetUserId, message) => {
    const token = jwtToken || authService.getToken();
    if (!token || !targetUserId) {
      throw new Error('User token or target user id missing.');
    }
    if (isBotUserId(targetUserId)) {
      await requestFriendship(targetUserId, token, user?.id);
      return;
    }
    try {
      await authService.sendFriendRequest(targetUserId, token, message);
    } catch (err) {
      if (err.status === 409 || (err.message && err.message.toLowerCase().includes('already exists'))) {
        // Request or friendship already exists on server, treat gracefully
        return;
      }
      throw err;
    }
    await loadFriendRequests(token);
  }, [jwtToken, user?.id, loadFriendRequests]);

  const acceptFriendRequest = useCallback(async (targetUserId) => {
    const token = jwtToken || authService.getToken();
    if (!token || !targetUserId) return false;
    // Guests can receive requests, but accepting one needs an account: show the Google
    // sign-in card, and the accept goes through automatically right after signing in.
    if (isGuest) {
      const req = friendRequestsRef.current.find(r => (r.id || r.friendUserId) === targetUserId);
      const who = req?.name || req?.username || 'their';
      setLiveFriendRequest(null);
      openUpgradeModal(
        who === 'their' ? 'Sign in to accept this friend request.' : `Sign in to accept ${who}'s friend request.`,
        { action: 'ACCEPT_FRIEND', targetUserId }
      );
      return false;
    }
    await authService.acceptFriendRequest(targetUserId, token);
    feedback('success');
    setFriendRequests(prev => prev.filter(r => r.id !== targetUserId));
    await loadFriendsFromApi(token);
    return true;
  }, [jwtToken, isGuest, openUpgradeModal, loadFriendsFromApi]);

  const rejectFriendRequest = useCallback(async (targetUserId) => {
    const token = jwtToken || authService.getToken();
    if (!token || !targetUserId) return;
    await authService.rejectFriendRequest(targetUserId, token);
    setFriendRequests(prev => prev.filter(r => r.id !== targetUserId));
  }, [jwtToken]);

  const cancelFriendRequest = useCallback(async (targetUserId) => {
    const token = jwtToken || authService.getToken();
    if (!token || !targetUserId) return;
    if (isBotUserId(targetUserId)) {
      setBotRelation(user?.id, targetUserId, null);
      return;
    }
    try {
      await authService.removeFriendApi(targetUserId, token);
      await loadFriendRequests(token);
    } catch (e) {
      console.warn('Failed to cancel friend request:', e);
    }
  }, [jwtToken, user?.id, loadFriendRequests]);

  const removeFriend = useCallback(async (friendId) => {
    const token = jwtToken || authService.getToken();
    setFriends(prev => prev.filter(f => f.id !== friendId && f.friendUserId !== friendId));

    if (token && friendId) {
      try {
        await authService.removeFriendApi(friendId, token);
        await loadFriendsFromApi(token);
      } catch (e) {
        console.warn('Failed to delete friendship on server:', e);
      }
    }
  }, [jwtToken, loadFriendsFromApi]);

  // Blocking drops any friendship/request server-side; mirror that locally right away.
  // Throws on failure so callers can show it.
  const blockUser = useCallback(async (targetUserId) => {
    const token = jwtToken || authService.getToken();
    if (!token || !targetUserId) return;
    // Bots: blocked on this device only, nothing is sent to the server.
    if (isBotUserId(targetUserId)) {
      setBotRelation(user?.id, targetUserId, 'BLOCKED');
      return;
    }
    await authService.blockUser(targetUserId, token);
    const notTarget = (u) => u.id !== targetUserId && u.friendUserId !== targetUserId;
    setFriends(prev => prev.filter(notTarget));
    setFriendRequests(prev => prev.filter(notTarget));
    setLiveFriendRequest(prev => (prev && !notTarget(prev) ? null : prev));
    loadFriendsFromApi(token);
    loadFriendRequests(token);
  }, [jwtToken, user?.id, loadFriendsFromApi, loadFriendRequests]);

  const unblockUser = useCallback(async (targetUserId) => {
    const token = jwtToken || authService.getToken();
    if (!token || !targetUserId) return;
    if (isBotUserId(targetUserId)) {
      setBotRelation(user?.id, targetUserId, null);
      return;
    }
    await authService.unblockUser(targetUserId, token);
  }, [jwtToken, user?.id]);

  // Block & report. A bot is only blocked on this device: no report or block reaches the server.
  const reportUser = useCallback(async (targetUserId, reason) => {
    const token = jwtToken || authService.getToken();
    if (!token || !targetUserId) return;
    if (isBotUserId(targetUserId)) {
      setBotRelation(user?.id, targetUserId, 'BLOCKED');
      return;
    }
    await authService.reportUser(targetUserId, reason, token);
    loadFriendsFromApi(token);
  }, [jwtToken, user?.id, loadFriendsFromApi]);

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
      const actionToExecute = pendingUpgradeActionRef.current || pendingUpgradeAction;
      closeUpgradeModal();
      setUser(res.user);
      setJwtToken(res.authResponse.jwt);

      if (actionToExecute) {
        if (actionToExecute.action === 'ACCEPT_FRIEND' && actionToExecute.targetUserId) {
          try {
            await authService.acceptFriendRequest(actionToExecute.targetUserId, res.authResponse.jwt);
            setFriendRequests(prev => prev.filter(r => (r.id !== actionToExecute.targetUserId && r.friendUserId !== actionToExecute.targetUserId)));
            setLiveFriendRequest(prev => {
              if (!prev) return null;
              const prevId = prev.id || prev.friendUserId;
              return prevId === actionToExecute.targetUserId ? null : prev;
            });
          } catch (err) {
            console.warn('[AuthContext] Error auto-accepting friend after upgrade:', err);
          }
        } else if (actionToExecute.action === 'SEND_FRIEND' && actionToExecute.targetUserId) {
          try {
            await requestFriendship(actionToExecute.targetUserId, res.authResponse.jwt, res.user?.id);
          } catch (err) {
            console.warn('[AuthContext] Error auto-sending friend request after upgrade:', err);
          }
        }
      }

      await loadFriendsFromApi(res.authResponse.jwt);
      await loadFriendRequests(res.authResponse.jwt);

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
  applyFirebaseSessionRef.current = applyFirebaseSession;

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
      const fbUser = await startGoogleSignIn({ purpose: 'login' });
      if (!fbUser) {
        return { status: 'REDIRECTING' }; // the page is navigating to Google
      }
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
   * Replays the friend action a guest tapped before signing in, with the NEW jwt. It runs
   * BEFORE the new session is applied: the token swap makes ChatBox re-query the friendship
   * status, and that query must already see the request, or the button stays on "Add friend".
   * An "already exists" answer counts as done.
   */
  const runPendingFriendAction = useCallback(async (action, jwt, selfId) => {
    const targetUserId = action?.targetUserId;
    if (!targetUserId || targetUserId === selfId) return;
    const alreadyExists = (err) => err?.status === 409 ||
      (err?.message && err.message.toLowerCase().includes('already exists'));
    const send = async () => {
      try {
        await requestFriendship(targetUserId, jwt, selfId);
      } catch (err) {
        if (!alreadyExists(err)) throw err;
      }
    };
    try {
      if (action.action === 'SEND_FRIEND') {
        await send();
      } else if (action.action === 'ACCEPT_FRIEND') {
        try {
          await authService.acceptFriendRequest(targetUserId, jwt);
        } catch (err) {
          // After switching to an existing account the request was addressed to the old
          // guest id, so there is nothing to accept: ask the other way round instead.
          await send();
        }
        setFriendRequests(prev => prev.filter(r => (r.id !== targetUserId && r.friendUserId !== targetUserId)));
        setLiveFriendRequest(prev => {
          if (!prev) return null;
          const prevId = prev.id || prev.friendUserId;
          return prevId === targetUserId ? null : prev;
        });
      }
    } catch (err) {
      console.warn('[AuthContext] Pending friend action after sign-in failed:', err);
    }
  }, []);

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

      const actionToExecute = pendingUpgradeActionRef.current || pendingUpgradeAction;
      closeUpgradeModal();
      await runPendingFriendAction(actionToExecute, res.jwt, res.userId);

      // Same user id, new JWT: persist the swap. The socket effect keeps the live
      // WebSocket connection intact, updating the token in place without disconnecting.
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

      await loadFriendsFromApi(res.jwt);
      await loadFriendRequests(res.jwt);
      return res;
    } catch (err) {
      setAuthError(err.message || 'Google account linking failed.');
      throw err;
    }
  }, [jwtToken, user, pendingUpgradeAction, closeUpgradeModal, runPendingFriendAction, loadFriendsFromApi, loadFriendRequests]);

  /**
   * A guest picked a Google account that already has a profile. Sign into that profile via
   * /auth/firebase/switch: the server hands the guest's live random chat over to it, so the
   * chat keeps running under the new id (no sessionEpoch bump, chat state is NOT reset).
   * The pending action (e.g. add friend) is replayed with the new account.
   * Returns the server response; NEEDS_USERNAME means it is a brand-new Google user and
   * nothing was changed (the caller continues with the link flow).
   */
  const signInToExistingGoogleAccount = useCallback(async (idToken) => {
    const token = jwtToken || authService.getToken();
    const res = await authService.firebaseSwitchAccount(idToken, token);
    if (res?.status === 'NEEDS_USERNAME' || !res?.jwt) {
      return res;
    }

    const actionToExecute = pendingUpgradeActionRef.current || pendingUpgradeAction;
    closeUpgradeModal();
    // Guest-only caches must not leak into the real account; the random chat lives in
    // SocketContext state and is kept.
    try {
      localStorage.removeItem('randomeet_dms');
      localStorage.removeItem('randomeet_friends');
    } catch (e) {}
    setFriends([]);
    setFriendRequests([]);
    setLiveFriendRequest(null);
    await runPendingFriendAction(actionToExecute, res.jwt, res.userId);
    // applyFirebaseSession also reloads friends and requests with the new token.
    applyFirebaseSession(res);
    return res;
  }, [jwtToken, pendingUpgradeAction, closeUpgradeModal, applyFirebaseSession, runPendingFriendAction]);

  const performLogout = useCallback(() => {
    setShowLogoutModal(false);
    // Stop this account's pushes on this device before the session token is discarded
    disablePushNotifications(authService.getToken());
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

  // The token-refresh effect is declared above performLogout; it reaches it through this ref.
  useEffect(() => { performLogoutRef.current = performLogout; }, [performLogout]);

  const logout = useCallback(() => requestLogout(), [requestLogout]);

  /**
   * Deletes the signed-in account. The server only MARKS it deleted (the row stays), then this
   * device signs out. Throws with a readable message when the server refuses.
   */
  const deleteAccount = useCallback(async () => {
    const token = jwtToken || authService.getToken();
    if (!user?.id || !token) throw new Error('You are not signed in.');
    await authService.deleteAccount(user.id, token);
    try {
      const { signOutFirebase } = await import('../services/firebaseClient');
      await signOutFirebase();
    } catch (e) { /* Firebase not configured: nothing to sign out of */ }
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('chatTheme:'))
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    performLogout();
  }, [jwtToken, user?.id, performLogout]);

  const dismissLiveFriendRequest = useCallback(() => setLiveFriendRequest(null), []);

  const acceptLiveFriendRequest = useCallback(async () => {
    if (!liveFriendRequest) return;
    const reqUserId = liveFriendRequest.id || liveFriendRequest.friendUserId;
    setLiveFriendRequest(null);
    if (reqUserId) {
      await acceptFriendRequest(reqUserId);
    }
  }, [liveFriendRequest, acceptFriendRequest]);

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
    authLoading,
    authError,
    showLogoutModal,
    requestLogout,
    cancelLogout,
    performLogout,
    deleteAccount,
    clearAuthError,
    login,
    signUp,
    loginAsGuest,
    upgradeGuestAccount,
    signInWithGoogle,
    completeGoogleSignup,
    linkGoogleAccount,
    signInToExistingGoogleAccount,
    firebaseConfigured: isFirebaseConfigured(),
    upgradeModalOpen,
    upgradeModalReason,
    pendingUpgradeAction,
    openUpgradeModal,
    closeUpgradeModal,
    googleRedirectLogin,
    clearGoogleRedirectLogin,
    googleRedirectUpgrade,
    clearGoogleRedirectUpgrade,
    logout,
    updateUserProfile,
    soundEnabled,
    setSoundEnabled,
    friends,
    totalUnreadFriendsCount,
    markFriendMessagesSeen,
    handleIncomingDirectMessage,
    activeDmFriendId,
    setActiveDmFriendId,
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
    blockUser,
    unblockUser,
    reportUser,
    loadFriendsFromApi
  }), [
    isAuthenticated, isGuest, jwtToken, user, sessionEpoch, authLoading,
    authError, showLogoutModal, requestLogout, cancelLogout, performLogout, deleteAccount, clearAuthError,
    login, signUp, loginAsGuest, upgradeGuestAccount, signInWithGoogle, completeGoogleSignup,
    linkGoogleAccount, signInToExistingGoogleAccount, upgradeModalOpen, upgradeModalReason,
    pendingUpgradeAction, openUpgradeModal, closeUpgradeModal, googleRedirectLogin,
    clearGoogleRedirectLogin, googleRedirectUpgrade, clearGoogleRedirectUpgrade, logout, updateUserProfile,
    soundEnabled, friends, totalUnreadFriendsCount, markFriendMessagesSeen, handleIncomingDirectMessage,
    activeDmFriendId, setActiveDmFriendId, friendRequests, friendRequestsLoading, liveFriendRequest,
    dismissLiveFriendRequest, acceptLiveFriendRequest, applyFriendPresence, addFriend,
    sendFriendRequest, cancelFriendRequest, loadFriendRequests, acceptFriendRequest,
    rejectFriendRequest, removeFriend, blockUser, unblockUser, reportUser, loadFriendsFromApi
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
