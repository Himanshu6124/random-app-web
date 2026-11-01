import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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

export function SocketProvider({ children }) {
  const { user, jwtToken, soundEnabled } = useAuth();

  // matchState: 'idle' | 'searching' | 'matched'
  const [matchState, setMatchState] = useState('idle');
  const [currentPeer, setCurrentPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [isPeerOnline, setIsPeerOnline] = useState(true);
  const [floatingReactions, setFloatingReactions] = useState([]);

  // Connection status: 'connecting' | 'connected' | 'disconnected'
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const [filters, setFilters] = useState({
    gender: 'All',
    interests: []
  });

  const typingTimerRef = useRef(null);
  const soundEnabledRef = useRef(soundEnabled);
  const userRef = useRef(user);

  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { userRef.current = user; }, [user]);

  /**
   * Called when a match is found from server CONVERSATION_DTO
   */
  const handleMatchFound = useCallback((peer) => {
    const resolvedName = extractPeerName(peer);
    const peerUsername = peer.friendUserId || peer.username || peer.peerId || '';
    const peerObj = {
      ...peer,
      username: peerUsername,
      friendUserId: peerUsername,
      name: resolvedName,
      friendUserName: resolvedName,
      userName: resolvedName
    };

    setCurrentPeer(peerObj);
    setIsPeerOnline(true);
    setIsPeerTyping(false);
    setMatchState('matched');

    // Subscribe to unified room channel
    const conversationId = peerObj.conversationId || peerObj.id;
    if (conversationId) {
      socketService.subscribeRoom(conversationId);
    }

    setMessages([
      {
        id: 'sys_' + Date.now(),
        senderId: 'system',
        text: `You are now connected with ${resolvedName}! Say hi!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    if (soundEnabledRef.current) playChime('match');
  }, []);

  const handleMessageReceived = useCallback((msg) => {
    const myUsername = userRef.current?.username || userRef.current?.id;

    setMessages(prev => {
      // Prevent duplicate messages if already in list
      if (prev.some(m => m.id === msg.id)) {
        return prev;
      }
      return [...prev, msg];
    });

    // Mark as seen immediately in random chat
    if (msg.id && msg.conversationId && msg.senderId !== myUsername) {
      socketService.sendRandomChatSeen(msg.conversationId, msg.id);
    }

    if (soundEnabledRef.current && msg.senderId !== myUsername) {
      playChime('message');
    }
  }, []);

  const handleMatchFoundRef = useRef(handleMatchFound);
  const handleMessageReceivedRef = useRef(handleMessageReceived);
  useEffect(() => { handleMatchFoundRef.current = handleMatchFound; }, [handleMatchFound]);
  useEffect(() => { handleMessageReceivedRef.current = handleMessageReceived; }, [handleMessageReceived]);

  // Connect STOMP socket when authenticated
  useEffect(() => {
    const userId = user?.username || user?.id;
    if (!jwtToken || !userId) {
      setConnectionStatus('disconnected');
      socketService.disconnect();
      return;
    }

    setConnectionStatus('connecting');

    socketService.connect(
      '/ws-chat',
      jwtToken,
      userId,
      {
        onConnect: () => {
          console.log('[SocketContext] STOMP connected successfully');
          setConnectionStatus('connected');
        },
        onDisconnect: () => {
          console.log('[SocketContext] STOMP disconnected');
          setConnectionStatus('disconnected');
        },
        onMatchFound: (conversation) => {
          handleMatchFoundRef.current(conversation);
        },
        onMessageReceived: (msg) => {
          handleMessageReceivedRef.current(msg);
        },
        onTypingStatus: (typing, payload) => {
          const myId = userRef.current?.username || userRef.current?.id;
          if (payload?.senderId && payload.senderId === myId) return;
          setIsPeerTyping(Boolean(typing));
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          if (typing) {
            typingTimerRef.current = setTimeout(() => {
              setIsPeerTyping(false);
            }, 3000);
          }
        },
        onOnlineStatus: (isOnline, payload) => {
          const myId = userRef.current?.username || userRef.current?.id;
          if (payload?.senderId && payload.senderId === myId) return;
          setIsPeerOnline(Boolean(isOnline));
        },
        onPeerDisconnected: (disconnectedUser) => {
          setIsPeerOnline(false);
          setIsPeerTyping(false);
          const peerName = typeof disconnectedUser === 'string' && disconnectedUser.trim() ? disconnectedUser : 'Stranger';
          setMessages(prev => [
            ...prev,
            {
              id: 'sys_' + Date.now(),
              senderId: 'system',
              text: `${peerName} has disconnected from the chat.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          setTimeout(() => {
            setMatchState('idle');
            setCurrentPeer(null);
            socketService.unsubscribeRoom();
          }, 2500);
        },
        onError: (err) => {
          console.warn('[SocketContext] STOMP error:', err);
          setConnectionStatus('disconnected');
        }
      }
    );

    return () => {
      socketService.disconnect();
    };
  }, [jwtToken, user?.username, user?.id]);

  const isLiveConnected = connectionStatus === 'connected' && socketService.isConnected;

  const startSearching = useCallback(() => {
    setMatchState('searching');
    setCurrentPeer(null);
    setMessages([]);
    socketService.startMatchmaking(user);
  }, [user]);

  const cancelSearch = useCallback(() => {
    setMatchState('idle');
    socketService.cancelMatchmaking();
  }, []);

  const skipStranger = useCallback(() => {
    setIsPeerTyping(false);
    setIsPeerOnline(true);
    if (currentPeer) {
      const convId = currentPeer.conversationId || currentPeer.id;
      socketService.sendDisconnect(convId);
      socketService.unsubscribeRoom();
    }
    setCurrentPeer(null);
    setMessages([]);
    setMatchState('searching');

    setTimeout(() => {
      socketService.startMatchmaking(user);
    }, 150);
  }, [currentPeer, user]);

  const disconnectChat = useCallback(() => {
    setIsPeerTyping(false);
    setIsPeerOnline(true);
    if (currentPeer) {
      const convId = currentPeer.conversationId || currentPeer.id;
      socketService.sendDisconnect(convId);
      socketService.unsubscribeRoom();
    }
    setCurrentPeer(null);
    setMatchState('idle');
    setMessages([]);
  }, [currentPeer]);

  const sendMessage = useCallback((text) => {
    if (!text || !text.trim() || !currentPeer) return;

    const messageText = text.trim();
    const conversationId = currentPeer.conversationId || currentPeer.id;

    if (conversationId) {
      // Use /app/chat.random.send for random matchmaking chat
      socketService.sendRandomChatMessage(conversationId, messageText, 'TEXT');
    }
  }, [currentPeer]);

  const notifyTyping = useCallback((isCurrentlyTyping) => {
    if (!currentPeer) return;
    const conversationId = currentPeer.conversationId || currentPeer.id;
    if (conversationId) {
      socketService.sendTyping(conversationId, isCurrentlyTyping);
    }
  }, [currentPeer]);

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

  const toggleInterestFilter = useCallback((tag) => {
    setFilters(prev => {
      const exists = prev.interests.includes(tag);
      const updated = exists
        ? prev.interests.filter(t => t !== tag)
        : [...prev.interests, tag];
      return { ...prev, interests: updated };
    });
  }, []);

  return (
    <SocketContext.Provider value={{
      matchState,
      currentPeer,
      messages,
      isPeerTyping,
      isPeerOnline,
      filters,
      setFilters,
      toggleInterestFilter,
      startSearching,
      cancelSearch,
      skipStranger,
      disconnectChat,
      sendMessage,
      sendReaction,
      sendIcebreaker,
      notifyTyping,
      floatingReactions,
      connectionStatus,
      isLiveConnected
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
