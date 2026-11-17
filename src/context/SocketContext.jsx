import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { socketService, extractPeerName } from '../services/socketService';
import { authService } from '../services/authService';
import { applyReaction } from '../components/chat/messageUtils';
import { feedback } from '../mobile/feedback';
import { notify, pageInView, navigateTo } from '../services/notify';
import { cleanTopicIds, formatTopics, loadSavedTopics, saveTopics } from '../content/matchTopics';

const SocketContext = createContext();

export const ICEBREAKER_QUESTIONS = [
  "If you could travel anywhere right now, where would you go?",
  "What is your all-time favorite movie or anime series?",
  "What's a song you can listen to on repeat without getting tired of it?",
  "If you had to eat one cuisine for the rest of your life, what would it be?",
  "Are you a night owl or an early bird?",
  "What is the most underrated video game or tech gadget in your opinion?",
  "What's the funniest or most memorable thing that happened to you recently?",
  "If you could have any superpower, what would you choose and why?"
];

const playChime = (type = 'match') => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'match') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'message') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch (e) {}
};

const systemMessage = (text) => ({
  id: 'sys_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
  senderId: 'system',
  text,
  timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
});

export function SocketProvider({ children }) {
  const {
    user,
    jwtToken,
    sessionEpoch,
    soundEnabled,
    setLiveFriendRequest,
    acceptFriendRequest,
    loadFriendRequests,
    loadFriendsFromApi,
    applyFriendPresence,
    handleIncomingDirectMessage,
    performLogout
  } = useAuth();

  // Tab management owned here so notifications and seen tracking work across tabs
  const [activeTab, setActiveTab] = useState('match');
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // Unread random match badge and notification alert
  const [unreadRandomCount, setUnreadRandomCount] = useState(0);
  const [liveRandomMessage, setLiveRandomMessage] = useState(null);

  // matchState: 'idle' | 'searching' | 'matched'
  const [matchState, setMatchState] = useState('idle');
  // Topics picked on the Match screen; sent with each search, remembered on this device.
  // Who to meet: 'any' | 'boy' | 'girl' | 'other' (remembered on this device).
  const [matchGender, setMatchGenderState] = useState(() => {
    try { return localStorage.getItem('rc.matchGender') || 'any'; } catch { return 'any'; }
  });
  const matchGenderRef = useRef(matchGender);
  const setMatchGender = useCallback((g) => {
    const next = g === 'boy' || g === 'girl' || g === 'other' ? g : 'any';
    matchGenderRef.current = next;
    setMatchGenderState(next);
    try { localStorage.setItem('rc.matchGender', next); } catch { /* private mode */ }
  }, []);
  const [matchTopics, setMatchTopicsState] = useState(loadSavedTopics);
  const matchTopicsRef = useRef(matchTopics);
  const setMatchTopics = useCallback((ids) => {
    const clean = cleanTopicIds(ids);
    matchTopicsRef.current = clean;
    setMatchTopicsState(clean);
    saveTopics(clean);
  }, []);
  const [currentPeer, setCurrentPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [isPeerOnline, setIsPeerOnline] = useState(true);
  // When the random peer was last online (set while they are temporarily disconnected)
  const [peerLastSeen, setPeerLastSeen] = useState(null);
  const [peerLeft, setPeerLeft] = useState(false);
  // Bumped after every reconnect / return from the background: views refetch what they show.
  const [resyncTick, setResyncTick] = useState(0);
  const [floatingReactions, setFloatingReactions] = useState([]);
  // Latest Spin the Bottle round of the random chat (server-decided), or null
  const [bottleGame, setBottleGame] = useState(null);

  // Connection status: 'connecting' | 'connected' | 'disconnected'
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const typingTimerRef = useRef(null);
  const skipTimerRef = useRef(null);
  const soundEnabledRef = useRef(soundEnabled);
  const userRef = useRef(user);
  const currentPeerRef = useRef(currentPeer);
  const previousUsernameRef = useRef(user?.username);
  const isPeerOnlineRef = useRef(true);
  const messagesRef = useRef(messages);
  const logoutRef = useRef(performLogout);
  const lastProfileSentRef = useRef({ conversationId: null, signature: null });
  const handleIncomingDirectMessageRef = useRef(handleIncomingDirectMessage);
  const peerLeftRef = useRef(false);
  const jwtTokenRef = useRef(jwtToken);
  useEffect(() => { jwtTokenRef.current = jwtToken; }, [jwtToken]);
  // Identity the socket was last opened for, to tell a guest -> existing-account switch
  // (same sessionEpoch, new user id: the random chat must survive) from a logout/login.
  const socketIdentityRef = useRef({ userId: null, epoch: sessionEpoch });

  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { currentPeerRef.current = currentPeer; }, [currentPeer]);
  useEffect(() => { isPeerOnlineRef.current = isPeerOnline; }, [isPeerOnline]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { peerLeftRef.current = peerLeft; }, [peerLeft]);
  useEffect(() => { logoutRef.current = performLogout; }, [performLogout]);
  useEffect(() => { handleIncomingDirectMessageRef.current = handleIncomingDirectMessage; }, [handleIncomingDirectMessage]);

  const activeConversationId = currentPeer?.conversationId || currentPeer?.id || null;

  // When returning to Random Match tab, clear unread notifications and send seen receipt
  useEffect(() => {
    if (activeTab === 'match') {
      setUnreadRandomCount(0);
      setLiveRandomMessage(null);

      const convId = currentPeerRef.current?.conversationId || currentPeerRef.current?.id;
      if (convId) {
        const lastPeerMsg = [...messagesRef.current].reverse().find(m => m.senderId && m.senderId !== userRef.current?.id);
        if (lastPeerMsg?.id) {
          socketService.sendRandomChatSeen(convId, lastPeerMsg.id);
        }
      }
    }
  }, [activeTab]);

  /**
   * Called when a match is found from server CONVERSATION_DTO
   */
  const handleMatchFound = useCallback((peer) => {
    const resolvedName = extractPeerName(peer);
    // IDENTITY = stable user id. username/name are display only.
    const peerId = peer.friendUserId || peer.peerId || '';
    const peerObj = {
      ...peer,
      id: peerId,
      friendUserId: peerId,
      username: peer.username || '',
      name: resolvedName,
      friendUserName: resolvedName,
      userName: resolvedName
    };

    setCurrentPeer(peerObj);
    setIsPeerOnline(true);
    setPeerLastSeen(null);
    setIsPeerTyping(false);
    setPeerLeft(false);
    setMatchState('matched');

    // Subscribe to unified room channel
    const conversationId = peerObj.conversationId || peerObj.id;
    if (conversationId) {
      socketService.subscribeRoom(conversationId);
    }

    const shared = formatTopics(peerObj.sharedTopics);
    setMessages([systemMessage(shared
      ? `You and ${resolvedName} both like ${shared}.`
      : `You and ${resolvedName} are connected.`)]);

    feedback('match');
    // On the Match tab the radar plays its own lock-on sound; elsewhere, the chime.
    if (soundEnabledRef.current && activeTabRef.current !== 'match') playChime('match');
  }, []);

  const handleMessageReceived = useCallback((msg) => {
    // Only random-chat room traffic belongs in this state; DM rooms have their own view.
    const activeConvId = currentPeerRef.current?.conversationId || currentPeerRef.current?.id;
    if (!activeConvId || msg.conversationId !== activeConvId) return;

    const myId = userRef.current?.id;
    const isPeerMsg = msg.senderId !== myId;

    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) {
        return prev;
      }
      return [...prev, msg];
    });

    if (isPeerMsg) {
      const peerForAlert = currentPeerRef.current;
      if (activeTabRef.current !== 'match' || !pageInView()) {
        notify({
          key: 'random-chat',
          kind: 'message',
          title: peerForAlert?.name || 'Random Match',
          body: msg.type === 'IMAGE' ? '📷 Photo' : (msg.text || msg.message || 'Sent you a message'),
          icon: peerForAlert?.photoUrl || '',
          target: { tab: 'match' }
        });
      }
      if (activeTabRef.current !== 'match') {
        // User is currently in Friends or Profile tab: inform them with red dot & notification card
        setUnreadRandomCount(c => c + 1);
        const peer = currentPeerRef.current;
        setLiveRandomMessage({
          id: msg.id || 'rand_' + Date.now(),
          peerName: peer?.name || 'Random Stranger',
          photoUrl: peer?.photoUrl || '',
          text: msg.type === 'IMAGE' ? '📷 Photo' : (msg.text || msg.message || ''),
          conversationId: msg.conversationId
        });
      } else {
        // User is looking directly at Random Match: mark message seen immediately
        if (msg.id) {
          socketService.sendRandomChatSeen(activeConvId, msg.id);
        }
      }

      feedback('receive');
      if (soundEnabledRef.current) {
        playChime('message');
      }
    }
  }, []);

  const handleMatchFoundRef = useRef(handleMatchFound);
  const handleMessageReceivedRef = useRef(handleMessageReceived);
  const loadFriendsRef = useRef(loadFriendsFromApi);

  /**
   * Spin the Bottle event for the random chat. SPIN starts the animation on both phones;
   * QUESTION also drops a card into the feed so the question stays in the conversation.
   */
  const handleGameEvent = useCallback((event) => {
    const activeConvId = currentPeerRef.current?.conversationId || currentPeerRef.current?.id;
    if (!event || !activeConvId || event.conversationId !== activeConvId) return;

    setBottleGame(prev => {
      // A late SPIN / CHOSEN must never rewind a round that has already moved on
      const order = { SPIN: 0, CHOSEN: 1, QUESTION: 2 };
      if (prev && prev.roundId === event.roundId && order[prev.phase] > order[event.phase]) {
        return prev;
      }
      // A close for an older round (a new spin already started) must not hide the new one
      if (event.phase === 'CLOSED' && prev && event.roundId && prev.roundId && prev.roundId !== event.roundId) {
        return prev;
      }
      return { ...event, receivedAt: Date.now() };
    });

    if (event.phase === 'QUESTION' && event.question) {
      const cardId = 'game_' + event.roundId;
      setMessages(prev => (prev.some(m => m.id === cardId) ? prev : [...prev, {
        id: cardId,
        conversationId: event.conversationId,
        senderId: 'game',
        type: 'GAME',
        choice: event.choice,
        question: event.question,
        targetId: event.targetId,
        askerId: event.askerId,
        custom: Boolean(event.custom),
        text: event.question,
        timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      }]));
    }
  }, []);
  const handleGameEventRef = useRef(handleGameEvent);
  useEffect(() => { handleGameEventRef.current = handleGameEvent; }, [handleGameEvent]);
  const loadRequestsRef = useRef(loadFriendRequests);
  const applyFriendPresenceRef = useRef(applyFriendPresence);
  const setLiveFriendRequestRef = useRef(setLiveFriendRequest);
  const acceptFriendRequestRef = useRef(acceptFriendRequest);
  useEffect(() => { acceptFriendRequestRef.current = acceptFriendRequest; }, [acceptFriendRequest]);

  useEffect(() => { handleMatchFoundRef.current = handleMatchFound; }, [handleMatchFound]);
  useEffect(() => { handleMessageReceivedRef.current = handleMessageReceived; }, [handleMessageReceived]);
  useEffect(() => { loadFriendsRef.current = loadFriendsFromApi; }, [loadFriendsFromApi]);
  useEffect(() => { loadRequestsRef.current = loadFriendRequests; }, [loadFriendRequests]);
  useEffect(() => { applyFriendPresenceRef.current = applyFriendPresence; }, [applyFriendPresence]);
  useEffect(() => { setLiveFriendRequestRef.current = setLiveFriendRequest; }, [setLiveFriendRequest]);

  /**
   * After a reconnect or a return from the background, ask the server which random room we are
   * still in. The server holds a room open for a few minutes when a socket drops, so the chat
   * usually just carries on; if the peer left (or the hold ran out) while we were away, say so
   * instead of showing a chat that can never deliver again.
   */
  const reconcileRandomRoom = useCallback(async () => {
    const peer = currentPeerRef.current;
    if (!peer || peerLeftRef.current) return;
    const convId = peer.conversationId || peer.id;
    const token = jwtTokenRef.current || authService.getToken();
    if (!convId || !token) return;

    let room;
    try {
      room = await authService.getRandomRoom(token);
    } catch {
      return; // offline or server hiccup: the next resume tries again
    }
    const still = currentPeerRef.current;
    if (!still || (still.conversationId || still.id) !== convId || peerLeftRef.current) return;

    if (!room || room.conversationId !== convId || !room.peerId) {
      setIsPeerOnline(false);
      setIsPeerTyping(false);
      setPeerLeft(true);
      setMessages(prev => [...prev, systemMessage(`${still.name || 'Your chat partner'} left the chat while you were away.`)]);
      return;
    }
    const online = Boolean(room.peerOnline);
    setIsPeerOnline(online);
    setPeerLastSeen(online ? null : (room.peerLastSeen || null));
  }, []);

  const resyncRef = useRef(() => {});
  const lastResyncRef = useRef(0);
  resyncRef.current = () => {
    const now = Date.now();
    if (now - lastResyncRef.current < 2000) return;
    lastResyncRef.current = now;
    loadFriendsRef.current?.();
    loadRequestsRef.current?.();
    reconcileRandomRoom();
    setResyncTick(t => t + 1);
  };

  // Seamlessly update socket token when jwtToken updates (e.g. guest upgrade)
  // without dropping the active WebSocket connection.
  useEffect(() => {
    if (jwtToken && socketService.isConnected) {
      socketService.updateToken(jwtToken);
    }
  }, [jwtToken]);

  // Connect STOMP socket when authenticated
  useEffect(() => {
    // The STOMP principal is the stable user id; activeUserId must match it exactly.
    const userId = user?.id;
    const activeToken = jwtToken || (typeof window !== 'undefined' ? localStorage.getItem('chat_jwt') : null);
    const previousIdentity = socketIdentityRef.current;
    socketIdentityRef.current = { userId: userId || null, epoch: sessionEpoch };
    // A guest signed into an existing account mid-chat: the server already moved the random
    // room to the new id, so keep the chat and carry it over to the new socket.
    const switchedIdentity = Boolean(
      userId && previousIdentity.userId && previousIdentity.userId !== userId &&
      previousIdentity.epoch === sessionEpoch
    );
    let carriedRoomId = null;
    if (switchedIdentity) {
      const oldId = previousIdentity.userId;
      setMessages(prev => prev.map(m => (m.senderId === oldId ? { ...m, senderId: userId } : m)));
      const peer = currentPeerRef.current;
      carriedRoomId = !peerLeftRef.current ? (peer?.conversationId || peer?.id || null) : null;
      // The server already announced the new profile to the peer: do not echo it again.
      const u = userRef.current;
      previousUsernameRef.current = u?.username || null;
      if (carriedRoomId && u?.username) {
        lastProfileSentRef.current = {
          conversationId: carriedRoomId,
          signature: `${u.username}|${u.name || ''}|${u.photoUrl || ''}`
        };
      }
    }

    if (!userId || !activeToken) {
      setConnectionStatus('disconnected');
      socketService.disconnect();
      return;
    }

    // If already connected for this exact user, keep the live connection intact
    if (socketService.isConnected && socketService.activeUserId === userId) {
      socketService.updateToken(activeToken);
      return;
    }

    setConnectionStatus('connecting');

    socketService.connect(
      '/ws-chat',
      activeToken,
      userId,
      {
        onConnect: () => {
          setConnectionStatus('connected');
          // connect() dropped the old identity's subscriptions; rejoin the handed-over room.
          if (carriedRoomId && !peerLeftRef.current) {
            socketService.subscribeRoom(carriedRoomId);
            carriedRoomId = null;
          }
          // Everything pushed while we were disconnected was missed: resync from the server
          // (friends + presence, requests, the random room, and any open DM via resyncTick).
          resyncRef.current();

          // The socket service replays every room subscription by itself; all that is
          // left here is telling the peer about a username that really changed.
          const activePeer = currentPeerRef.current;
          const convId = activePeer?.conversationId || activePeer?.id;
          const currentUser = userRef.current;
          const previousUsername = previousUsernameRef.current;

          if (convId && currentUser?.username && previousUsername && previousUsername !== currentUser.username) {
            socketService.sendPeerUpdated(convId, {
              previousUsername,
              username: currentUser.username,
              name: currentUser.name || currentUser.username,
              photoUrl: currentUser.photoUrl || ''
            });
            previousUsernameRef.current = currentUser.username;
          }
        },
        onDisconnect: () => {
          setConnectionStatus('disconnected');
        },
        onResume: ({ connected }) => {
          // Back from the background with the socket still up: pushes may have been throttled
          // while the page was frozen, so refresh anyway. (A dead socket resyncs on reconnect.)
          if (connected) resyncRef.current();
        },
        onGameInvite: (payload) => {
          const fromId = payload?.id || payload?.senderId;
          notify({
            key: `game-invite-${fromId}`,
            kind: 'match',
            title: payload?.name || payload?.username || 'A friend',
            body: 'wants to play Truth & Dare with you 🎲',
            icon: payload?.photoUrl || '',
            target: fromId ? { tab: 'friends', friendId: fromId } : { tab: 'friends' },
            action: fromId ? {
              label: 'Play',
              run: () => navigateTo({ tab: 'friends', friendId: fromId })
            } : undefined
          });
          feedback('notify');
          if (soundEnabledRef.current) playChime('match');
        },
        onAuthExpired: () => {
          setConnectionStatus('disconnected');
          logoutRef.current?.();
        },
        onMatchFound: (conversation) => {
          handleMatchFoundRef.current(conversation);
        },
        onMatchCancelled: () => {
          setMatchState(prev => (prev === 'searching' ? 'idle' : prev));
        },
        onMessageReceived: (msg) => {
          handleMessageReceivedRef.current(msg);
        },
        onGameEvent: (event) => {
          handleGameEventRef.current(event);
        },
        onDirectMessageReceived: (payload) => {
          handleIncomingDirectMessageRef.current?.(payload);
          if (soundEnabledRef.current) playChime('message');
        },
        onReaction: (payload) => {
          const activeConvId = currentPeerRef.current?.conversationId || currentPeerRef.current?.id;
          if (!activeConvId || payload?.conversationId !== activeConvId) return;
          setMessages(prev => prev.map(m => applyReaction(m, payload)));
        },
        onMessageSeen: (payload) => {
          const activeConvId = currentPeerRef.current?.conversationId || currentPeerRef.current?.id;
          if (!activeConvId || payload?.conversationId !== activeConvId) return;

          const myId = userRef.current?.id;
          setMessages(prev => prev.map(m => {
            if (m.senderId === myId) {
              return { ...m, status: 'SEEN' };
            }
            return m;
          }));
        },
        onTypingStatus: (typing, payload) => {
          const activeConvId = currentPeerRef.current?.conversationId || currentPeerRef.current?.id;
          if (!activeConvId || payload?.conversationId !== activeConvId) return;

          setIsPeerTyping(Boolean(typing));
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          if (typing) {
            typingTimerRef.current = setTimeout(() => {
              setIsPeerTyping(false);
            }, 3000);
          }
        },
        onFriendPresence: (friendId, online, lastSeen) => {
          applyFriendPresenceRef.current?.(friendId, online, lastSeen);
        },
        onOnlineStatus: (isOnline, payload) => {
          // Friends list presence is pushed from the room the friend shares with us
          if (payload?.senderId) {
            applyFriendPresenceRef.current?.(payload.senderId, Boolean(isOnline), payload.lastSeen || null);
          }

          const activeConvId = currentPeerRef.current?.conversationId || currentPeerRef.current?.id;
          if (!activeConvId || payload?.conversationId !== activeConvId) return;

          if (peerLeftRef.current) return; // a chat that ended stays ended
          const wasOffline = !isPeerOnlineRef.current;
          const nowOnline = Boolean(isOnline);
          setIsPeerOnline(nowOnline);
          setPeerLastSeen(nowOnline ? null : (payload?.lastSeen || new Date().toISOString()));
          if (!nowOnline) setIsPeerTyping(false);

          const peerName = currentPeerRef.current?.name || 'Your chat partner';
          if (wasOffline && nowOnline) {
            setMessages(prev => [...prev, systemMessage(`${peerName} is back. You can keep chatting.`)]);
          } else if (!wasOffline && !nowOnline) {
            setMessages(prev => [...prev, systemMessage(`${peerName} got disconnected. They can come back to this chat in a few minutes.`)]);
          }
        },
        onPeerUpdated: (payload) => {
          const myId = userRef.current?.id;
          const activeConvId = currentPeerRef.current?.conversationId || currentPeerRef.current?.id;
          if (!activeConvId || payload?.conversationId !== activeConvId) return;
          // Identity comparison is on userId; the display fields just get refreshed.
          if (!payload?.userId || payload.userId === myId) return;
          // Our own guest -> existing-account switch, echoed to our still-open guest socket:
          // it describes US, never the peer.
          if (payload.previousUserId && payload.previousUserId === myId) return;
          // Server-announced identity change: the stranger signed into their existing account.
          const switchedFrom = payload.previousUserId && payload.previousUserId !== myId
            ? payload.previousUserId : null;

          setCurrentPeer(prev => {
            if (!prev) return prev;
            const idFields = switchedFrom && (prev.id === switchedFrom || prev.friendUserId === switchedFrom)
              ? { id: payload.userId, friendUserId: payload.userId, peerId: payload.userId, isGuest: false }
              : {};
            return {
              ...prev,
              ...idFields,
              username: payload.username || prev.username,
              name: payload.name || payload.username || prev.name,
              friendUserName: payload.name || payload.username || prev.friendUserName,
              photoUrl: payload.photoUrl || prev.photoUrl
            };
          });
          setIsPeerOnline(true);

          setMessages(prev => [
            ...prev,
            systemMessage(switchedFrom
              ? `${payload.name || payload.username} signed in to their account.`
              : `${payload.name || payload.username} updated their profile.`)
          ]);
        },
        onPeerDisconnected: (_disconnectedUser, conversationId) => {
          const activeConvId = currentPeerRef.current?.conversationId || currentPeerRef.current?.id;
          if (!activeConvId || conversationId !== activeConvId) return;

          setIsPeerOnline(false);
          setIsPeerTyping(false);
          setPeerLeft(true);
          setMessages(prev => [
            ...prev,
            systemMessage(`${currentPeerRef.current?.name || 'Your chat partner'} left the chat.`)
          ]);
        },
        onFriendRequestReceived: (sender) => {
          setLiveFriendRequestRef.current?.(sender);
          const senderId = sender?.id || sender?.friendUserId;
          notify({
            key: `friend-request-${senderId}`,
            kind: 'request',
            title: sender?.name || sender?.username || 'Someone',
            body: 'sent you a friend request',
            icon: sender?.photoUrl || '',
            target: { tab: 'friends' },
            action: senderId ? {
              label: 'Accept',
              run: () => {
                setLiveFriendRequestRef.current?.(null);
                acceptFriendRequestRef.current?.(senderId)?.catch?.(() => {});
              }
            } : undefined
          });
          loadRequestsRef.current?.();
          feedback('notify');
          if (soundEnabledRef.current) playChime('match');
        },
        onFriendRequestAccepted: (friend) => {
          const friendId = friend?.id || friend?.friendUserId;
          notify({
            key: `friend-accepted-${friendId}`,
            kind: 'success',
            title: friend?.name || friend?.username || 'New friend',
            body: 'accepted your friend request',
            icon: friend?.photoUrl || '',
            target: friendId ? { tab: 'friends', friendId } : { tab: 'friends' }
          });
          loadFriendsRef.current?.();
          loadRequestsRef.current?.();
          feedback('success');
          if (soundEnabledRef.current) playChime('match');
        },
        onFriendRequestCancelled: (payload) => {
          const cancelledById = payload?.id;
          setLiveFriendRequestRef.current?.(prev => {
            if (!prev) return null;
            const prevUserId = prev.id || prev.friendUserId;
            return prevUserId === cancelledById ? null : prev;
          });
          loadRequestsRef.current?.();
          loadFriendsRef.current?.();
        },
        onChatError: (payload) => {
          // The server refused this message (too long, or it could not be saved). Random
          // chat has no local echo, so without this the text would vanish silently.
          const activeConvId = currentPeerRef.current?.conversationId || currentPeerRef.current?.id;
          if (!activeConvId) return;
          if (payload?.conversationId && payload.conversationId !== activeConvId) return;

          setMessages(prev => [...prev, {
            id: 'error_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            conversationId: activeConvId,
            senderId: userRef.current?.id,
            text: payload?.reason || 'Message could not be delivered',
            message: payload?.reason || 'Message could not be delivered',
            status: 'FAILED',
            // The server rejected the content itself, so re-sending it would fail again:
            // this entry carries the reason, not the original text, and offers no retry.
            serverRefused: true,
            timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          }]);
        },
        onError: (err) => {
          console.warn('[SocketContext] STOMP error:', err);
          setConnectionStatus('disconnected');
        }
      }
    );

    return () => {
      socketService.disconnect();
      // disconnect() cancels any waiting ticket, so the radar must stop spinning too.
      setMatchState(prev => (prev === 'searching' ? 'idle' : prev));
    };
  }, [user?.id, sessionEpoch]);

  // Tell the current random peer about a REAL profile change (name / photo / upgrade)
  useEffect(() => {
    if (matchState !== 'matched' || !activeConversationId || !user?.username) return;

    const signature = `${user.username}|${user.name || ''}|${user.photoUrl || ''}`;
    const last = lastProfileSentRef.current;

    if (last.conversationId !== activeConversationId) {
      // New room: record the baseline, there is nothing to announce yet.
      lastProfileSentRef.current = { conversationId: activeConversationId, signature };
      return;
    }
    if (last.signature === signature) return;

    socketService.sendPeerUpdated(activeConversationId, {
      previousUsername: previousUsernameRef.current || user.username,
      username: user.username,
      name: user.name || user.username,
      photoUrl: user.photoUrl || ''
    });
    lastProfileSentRef.current = { conversationId: activeConversationId, signature };
    previousUsernameRef.current = user.username;
  }, [matchState, activeConversationId, user?.username, user?.name, user?.photoUrl]);

  // Logout must not leave the previous user's chat on screen for the next one
  useEffect(() => {
    if (!sessionEpoch) return;
    setMatchState('idle');
    setCurrentPeer(null);
    setMessages([]);
    setIsPeerTyping(false);
    setIsPeerOnline(true);
    setPeerLastSeen(null);
    setPeerLeft(false);
    setFloatingReactions([]);
    previousUsernameRef.current = null;
    lastProfileSentRef.current = { conversationId: null, signature: null };
  }, [sessionEpoch]);

  const isLiveConnected = connectionStatus === 'connected';

  const startSearching = useCallback(() => {
    if (skipTimerRef.current) {
      clearTimeout(skipTimerRef.current);
      skipTimerRef.current = null;
    }
    const previousConvId = currentPeerRef.current?.conversationId || currentPeerRef.current?.id;
    if (previousConvId) {
      socketService.sendDisconnect(previousConvId);
      socketService.unsubscribeRoom(previousConvId);
    }
    setUnreadRandomCount(0);
    setLiveRandomMessage(null);
    setMatchState('searching');
    setCurrentPeer(null);
    setPeerLeft(false);
    setMessages([]);
    socketService.startMatchmaking({ topics: matchTopicsRef.current, gender: matchGenderRef.current });
  }, []);

  const cancelSearch = useCallback(() => {
    if (skipTimerRef.current) {
      clearTimeout(skipTimerRef.current);
      skipTimerRef.current = null;
    }
    setUnreadRandomCount(0);
    setLiveRandomMessage(null);
    setMatchState('idle');
    socketService.cancelMatchmaking({ notifyServer: true });
  }, []);

  const skipStranger = useCallback(() => {
    setIsPeerTyping(false);
    setIsPeerOnline(true);
    setPeerLeft(false);
    setUnreadRandomCount(0);
    setLiveRandomMessage(null);

    const convId = currentPeerRef.current?.conversationId || currentPeerRef.current?.id;
    if (convId) {
      socketService.sendDisconnect(convId);
      socketService.unsubscribeRoom(convId);
    }

    setCurrentPeer(null);
    setMessages([]);
    setMatchState('searching');

    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    skipTimerRef.current = setTimeout(() => {
      skipTimerRef.current = null;
      socketService.startMatchmaking({ topics: matchTopicsRef.current, gender: matchGenderRef.current });
    }, 150);
  }, []);

  const disconnectChat = useCallback(() => {
    if (skipTimerRef.current) {
      clearTimeout(skipTimerRef.current);
      skipTimerRef.current = null;
    }
    setIsPeerTyping(false);
    setIsPeerOnline(true);
    setPeerLeft(false);
    setUnreadRandomCount(0);
    setLiveRandomMessage(null);

    const convId = currentPeerRef.current?.conversationId || currentPeerRef.current?.id;
    if (convId) {
      socketService.sendDisconnect(convId);
      socketService.unsubscribeRoom(convId);
    }

    setCurrentPeer(null);
    setMatchState('idle');
    setMessages([]);
    socketService.cancelMatchmaking({ notifyServer: true });
  }, []);

  useEffect(() => {
    return () => {
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  /**
   * Sends a random-chat message. Random chat is never persisted, so anything we
   * cannot put on the wire right now is kept locally as FAILED with a retry.
   */
  const sendMessage = useCallback((text, referredMessageId = null) => {
    if (!text || !text.trim() || !currentPeer) return false;

    const messageText = text.trim();
    const conversationId = currentPeer.conversationId || currentPeer.id;
    if (!conversationId) return false;

    const canDeliver = isPeerOnline && !peerLeft;
    const delivered = canDeliver && socketService.sendRandomChatMessage(conversationId, messageText, 'TEXT', null, referredMessageId);

    if (!delivered) {
      setMessages(prev => [...prev, {
        id: 'failed_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        conversationId,
        senderId: userRef.current?.id,
        text: messageText,
        message: messageText,
        referredMessageId,
        status: 'FAILED',
        timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      }]);
    }

    return delivered;
  }, [currentPeer, isPeerOnline, peerLeft]);

  /**
   * Retries a FAILED message. On success the local copy is dropped so the server
   * echo is the only rendered copy and retry cannot duplicate the message.
   */
  const retryMessage = useCallback((msgId) => {
    if (!currentPeer || peerLeft || !isPeerOnline) return false;

    const conversationId = currentPeer.conversationId || currentPeer.id;
    if (!conversationId) return false;

    const msg = messagesRef.current.find(m => m.id === msgId);
    if (!msg || msg.serverRefused) return false;

    const sent = socketService.sendRandomChatMessage(conversationId, msg.text || msg.message, 'TEXT', null, msg.referredMessageId || null);
    if (sent) {
      setMessages(prev => prev.filter(m => m.id !== msgId));
    }
    return sent;
  }, [currentPeer, isPeerOnline, peerLeft]);

  const notifyTyping = useCallback((isCurrentlyTyping) => {
    if (!currentPeer || peerLeft) return;
    const conversationId = currentPeer.conversationId || currentPeer.id;
    if (conversationId) {
      socketService.sendTyping(conversationId, isCurrentlyTyping);
    }
  }, [currentPeer, peerLeft]);

  /**
   * Sends an uploaded media message (image or voice note) into the random chat.
   * MediaComposer uploads first and calls this with { type, objectUri, localPreviewUrl }.
   * Failure becomes a visible FAILED bubble with no retry (retrying would need the file,
   * not the text) — matching the "never look sent when it is not" rule.
   */
  const sendMedia = useCallback(({ type, objectUri, localPreviewUrl, referredMessageId = null }) => {
    if (!currentPeer || peerLeft || !isPeerOnline) return false;

    const conversationId = currentPeer.conversationId || currentPeer.id;
    if (!conversationId || !objectUri) return false;

    const caption = type === 'IMAGE' ? '📷 Photo' : '🎤 Voice note';
    const delivered = socketService.sendRandomChatMessage(conversationId, caption, type, objectUri, referredMessageId);

    if (!delivered) {
      setMessages(prev => [...prev, {
        id: 'failed_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        conversationId,
        senderId: userRef.current?.id,
        text: caption,
        message: caption,
        type,
        objectUri,
        localPreviewUrl,
        referredMessageId,
        status: 'FAILED',
        // No retry affordance for media: a text re-send would lose the file.
        serverRefused: true,
        timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      }]);
    }
    return delivered;
  }, [currentPeer, isPeerOnline, peerLeft]);

  const sendReaction = useCallback((emoji) => {
    if (peerLeftRef.current || !isPeerOnlineRef.current) return;
    const reactionObj = {
      id: 'react_' + Date.now() + Math.random(),
      emoji,
      left: Math.random() * 60 + 20 + '%'
    };
    setFloatingReactions(prev => [...prev, reactionObj]);
    sendMessage(emoji);

    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== reactionObj.id));
    }, 1800);
  }, [sendMessage]);

  /**
   * React to a message in the random chat (null emoji removes the reaction). Applied locally
   * right away; the server echo carries the same change, so applying it twice is harmless.
   */
  const reactToMessage = useCallback((messageId, emoji) => {
    const conversationId = currentPeer?.conversationId || currentPeer?.id;
    if (!conversationId || !messageId || peerLeft || !isPeerOnline) return false;
    const sent = socketService.sendMessageReaction(conversationId, messageId, emoji);
    if (sent) {
      const reaction = { senderId: userRef.current?.id, messageId, emoji };
      setMessages(prev => prev.map(m => applyReaction(m, reaction)));
    }
    return sent;
  }, [currentPeer, peerLeft, isPeerOnline]);

  const sendIcebreaker = useCallback(() => {
    if (peerLeftRef.current || !isPeerOnlineRef.current) return false;
    const questions = ICEBREAKER_QUESTIONS;
    const randomQ = questions[Math.floor(Math.random() * questions.length)];
    sendMessage(randomQ);
  }, [sendMessage]);

  const spinBottle = useCallback(() => {
    const conversationId = currentPeer?.conversationId || currentPeer?.id;
    if (!conversationId || peerLeft || !isPeerOnline) return false;
    return socketService.spinBottle(conversationId);
  }, [currentPeer, peerLeft, isPeerOnline]);

  const askGameQuestion = useCallback((roundId, question, custom) => {
    const conversationId = currentPeer?.conversationId || currentPeer?.id;
    if (!conversationId || peerLeft) return false;
    return socketService.askGameQuestion(conversationId, roundId, question, custom);
  }, [currentPeer, peerLeft]);

  const closeGame = useCallback(() => {
    const conversationId = currentPeer?.conversationId || currentPeer?.id;
    if (!conversationId) return false;
    return socketService.closeGame(conversationId);
  }, [currentPeer]);

  const chooseGameOption = useCallback((roundId, choice) => {
    const conversationId = currentPeer?.conversationId || currentPeer?.id;
    if (!conversationId || peerLeft) return false;
    return socketService.chooseGameOption(conversationId, roundId, choice);
  }, [currentPeer, peerLeft]);

  const clearUnreadRandomCount = useCallback(() => setUnreadRandomCount(0), []);
  const dismissLiveRandomMessage = useCallback(() => setLiveRandomMessage(null), []);

  const value = useMemo(() => ({
    activeTab,
    setActiveTab,
    unreadRandomCount,
    clearUnreadRandomCount,
    liveRandomMessage,
    dismissLiveRandomMessage,
    matchState,
    matchTopics,
    matchGender,
    setMatchGender,
    setMatchTopics,
    currentPeer,
    messages,
    isPeerTyping,
    isPeerOnline,
    peerLastSeen,
    peerLeft,
    resyncTick,
    startSearching,
    cancelSearch,
    skipStranger,
    disconnectChat,
    sendMessage,
    sendMedia,
    retryMessage,
    sendReaction,
    reactToMessage,
    sendIcebreaker,
    notifyTyping,
    floatingReactions,
    bottleGame,
    spinBottle,
    chooseGameOption,
    askGameQuestion,
    closeGame,
    connectionStatus,
    isLiveConnected
  }), [
    activeTab, setActiveTab, unreadRandomCount, clearUnreadRandomCount, liveRandomMessage,
    dismissLiveRandomMessage, matchState, matchTopics, setMatchTopics, matchGender, setMatchGender, currentPeer, messages, isPeerTyping, isPeerOnline, peerLastSeen, peerLeft, resyncTick,
    startSearching, cancelSearch, skipStranger, disconnectChat, sendMessage,
    retryMessage, sendMedia, sendReaction, reactToMessage, sendIcebreaker, notifyTyping, floatingReactions,
    bottleGame, spinBottle, chooseGameOption, askGameQuestion, closeGame, connectionStatus, isLiveConnected
  ]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
