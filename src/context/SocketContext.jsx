import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { socketService, extractPeerName } from '../services/socketService';

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
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
});

export function SocketProvider({ children }) {
  const {
    user,
    jwtToken,
    sessionEpoch,
    soundEnabled,
    setLiveFriendRequest,
    loadFriendRequests,
    loadFriendsFromApi,
    applyFriendPresence,
    handleIncomingDirectMessage,
    performLogout
  } = useAuth();

  // Tab management owned here so notifications and seen tracking work across tabs
  const [activeTab, setActiveTab] = useState('match');
  // A friend tapped "Wave" on the Nearby map (FRIEND_WAVE on /user/queue/notifications)
  const [liveWave, setLiveWave] = useState(null);
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // Unread random match badge and notification alert
  const [unreadRandomCount, setUnreadRandomCount] = useState(0);
  const [liveRandomMessage, setLiveRandomMessage] = useState(null);

  // matchState: 'idle' | 'searching' | 'matched'
  const [matchState, setMatchState] = useState('idle');
  const [currentPeer, setCurrentPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [isPeerOnline, setIsPeerOnline] = useState(true);
  const [peerLeft, setPeerLeft] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);

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

  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { currentPeerRef.current = currentPeer; }, [currentPeer]);
  useEffect(() => { isPeerOnlineRef.current = isPeerOnline; }, [isPeerOnline]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
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
    setIsPeerTyping(false);
    setPeerLeft(false);
    setMatchState('matched');

    // Subscribe to unified room channel
    const conversationId = peerObj.conversationId || peerObj.id;
    if (conversationId) {
      socketService.subscribeRoom(conversationId);
    }

    setMessages([systemMessage(`You are now connected with ${resolvedName}! Say hi!`)]);

    if (soundEnabledRef.current) playChime('match');
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

      if (soundEnabledRef.current) {
        playChime('message');
      }
    }
  }, []);

  const handleMatchFoundRef = useRef(handleMatchFound);
  const handleMessageReceivedRef = useRef(handleMessageReceived);
  const loadFriendsRef = useRef(loadFriendsFromApi);
  const loadRequestsRef = useRef(loadFriendRequests);
  const applyFriendPresenceRef = useRef(applyFriendPresence);
  const setLiveFriendRequestRef = useRef(setLiveFriendRequest);

  useEffect(() => { handleMatchFoundRef.current = handleMatchFound; }, [handleMatchFound]);
  useEffect(() => { handleMessageReceivedRef.current = handleMessageReceived; }, [handleMessageReceived]);
  useEffect(() => { loadFriendsRef.current = loadFriendsFromApi; }, [loadFriendsFromApi]);
  useEffect(() => { loadRequestsRef.current = loadFriendRequests; }, [loadFriendRequests]);
  useEffect(() => { applyFriendPresenceRef.current = applyFriendPresence; }, [applyFriendPresence]);
  useEffect(() => { setLiveFriendRequestRef.current = setLiveFriendRequest; }, [setLiveFriendRequest]);

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
          // Presence changes while we were disconnected were missed: resync from the server.
          if (!userRef.current?.isGuest) loadFriendsRef.current?.();

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
        onDirectMessageReceived: (payload) => {
          handleIncomingDirectMessageRef.current?.(payload);
          if (soundEnabledRef.current) playChime('message');
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
        onFriendPresence: (friendId, online) => {
          applyFriendPresenceRef.current?.(friendId, online);
        },
        onOnlineStatus: (isOnline, payload) => {
          // Friends list presence is pushed from the room the friend shares with us
          if (payload?.senderId) {
            applyFriendPresenceRef.current?.(payload.senderId, Boolean(isOnline));
          }

          const activeConvId = currentPeerRef.current?.conversationId || currentPeerRef.current?.id;
          if (!activeConvId || payload?.conversationId !== activeConvId) return;

          const wasOffline = !isPeerOnlineRef.current;
          const nowOnline = Boolean(isOnline);
          setIsPeerOnline(nowOnline);

          // Only announce if returning back online from an offline state
          if (wasOffline && nowOnline) {
            setMessages(prev => [
              ...prev,
              systemMessage(`${currentPeerRef.current?.name || 'Your chat partner'} is back online! You can now send messages.`)
            ]);
          }
        },
        onPeerUpdated: (payload) => {
          const myId = userRef.current?.id;
          const activeConvId = currentPeerRef.current?.conversationId || currentPeerRef.current?.id;
          if (!activeConvId || payload?.conversationId !== activeConvId) return;
          // Identity comparison is on userId; the display fields just get refreshed.
          if (!payload?.userId || payload.userId === myId) return;

          setCurrentPeer(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              username: payload.username || prev.username,
              name: payload.name || payload.username || prev.name,
              friendUserName: payload.name || payload.username || prev.friendUserName,
              photoUrl: payload.photoUrl || prev.photoUrl
            };
          });
          setIsPeerOnline(true);

          setMessages(prev => [
            ...prev,
            systemMessage(`${payload.name || payload.username} updated their profile.`)
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
            systemMessage('Your chat partner left the chat.')
          ]);
        },
        onFriendRequestReceived: (sender) => {
          setLiveFriendRequestRef.current?.(sender);
          loadRequestsRef.current?.();
          if (soundEnabledRef.current) playChime('match');
        },
        onFriendWave: (sender) => {
          if (!sender) return;
          setLiveWave({ ...sender, receivedAt: Date.now() });
          if (soundEnabledRef.current) playChime('message');
        },
        onFriendRequestAccepted: () => {
          loadFriendsRef.current?.();
          loadRequestsRef.current?.();
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
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
    socketService.startMatchmaking(userRef.current);
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
      socketService.startMatchmaking(userRef.current);
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
  const sendMessage = useCallback((text) => {
    if (!text || !text.trim() || !currentPeer) return false;

    const messageText = text.trim();
    const conversationId = currentPeer.conversationId || currentPeer.id;
    if (!conversationId) return false;

    const canDeliver = isPeerOnline && !peerLeft;
    const delivered = canDeliver && socketService.sendRandomChatMessage(conversationId, messageText, 'TEXT');

    if (!delivered) {
      setMessages(prev => [...prev, {
        id: 'failed_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        conversationId,
        senderId: userRef.current?.id,
        text: messageText,
        message: messageText,
        status: 'FAILED',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

    const sent = socketService.sendRandomChatMessage(conversationId, msg.text || msg.message, 'TEXT');
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
  const sendMedia = useCallback(({ type, objectUri, localPreviewUrl }) => {
    if (!currentPeer || peerLeft || !isPeerOnline) return false;

    const conversationId = currentPeer.conversationId || currentPeer.id;
    if (!conversationId || !objectUri) return false;

    const caption = type === 'IMAGE' ? '📷 Photo' : '🎤 Voice note';
    const delivered = socketService.sendRandomChatMessage(conversationId, caption, type, objectUri);

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
        status: 'FAILED',
        // No retry affordance for media: a text re-send would lose the file.
        serverRefused: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
    return delivered;
  }, [currentPeer, isPeerOnline, peerLeft]);

  const sendReaction = useCallback((emoji) => {
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

  const sendIcebreaker = useCallback(() => {
    const questions = ICEBREAKER_QUESTIONS;
    const randomQ = questions[Math.floor(Math.random() * questions.length)];
    sendMessage(`🧊 Icebreaker: ${randomQ}`);
  }, [sendMessage]);

  const clearUnreadRandomCount = useCallback(() => setUnreadRandomCount(0), []);
  const dismissLiveWave = useCallback(() => setLiveWave(null), []);
  const dismissLiveRandomMessage = useCallback(() => setLiveRandomMessage(null), []);

  const value = useMemo(() => ({
    activeTab,
    setActiveTab,
    unreadRandomCount,
    clearUnreadRandomCount,
    liveRandomMessage,
    dismissLiveRandomMessage,
    liveWave,
    dismissLiveWave,
    matchState,
    currentPeer,
    messages,
    isPeerTyping,
    isPeerOnline,
    peerLeft,
    startSearching,
    cancelSearch,
    skipStranger,
    disconnectChat,
    sendMessage,
    sendMedia,
    retryMessage,
    sendReaction,
    sendIcebreaker,
    notifyTyping,
    floatingReactions,
    connectionStatus,
    isLiveConnected
  }), [
    activeTab, setActiveTab, unreadRandomCount, clearUnreadRandomCount, liveRandomMessage,
    dismissLiveRandomMessage, liveWave, dismissLiveWave, matchState, currentPeer, messages, isPeerTyping, isPeerOnline, peerLeft,
    startSearching, cancelSearch, skipStranger, disconnectChat, sendMessage,
    retryMessage, sendMedia, sendReaction, sendIcebreaker, notifyTyping, floatingReactions,
    connectionStatus, isLiveConnected
  ]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
