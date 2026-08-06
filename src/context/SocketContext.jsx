import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { socketService, extractPeerName } from '../services/socketService';
import { MockMatchEngine, ICEBREAKER_QUESTIONS } from '../services/mockMatchEngine';

const SocketContext = createContext();

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
  const [floatingReactions, setFloatingReactions] = useState([]);

  // Connection status: 'connecting' | 'connected' | 'mock' | 'disconnected'
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const [filters, setFilters] = useState({
    gender: 'All',
    interests: []
  });

  const mockEngineRef = useRef(null);
  const typingTimerRef = useRef(null);
  const mockFallbackTimerRef = useRef(null);
  
  const matchStateRef = useRef('idle');
  useEffect(() => { matchStateRef.current = matchState; }, [matchState]);

  const soundEnabledRef = useRef(soundEnabled);
  const userRef = useRef(user);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { userRef.current = user; }, [user]);

  /**
   * Called when match is found (from server CONVERSATION_DTO or mock fallback)
   */
  const handleMatchFound = useCallback((peer) => {
    if (mockFallbackTimerRef.current) {
      clearTimeout(mockFallbackTimerRef.current);
      mockFallbackTimerRef.current = null;
    }

    const resolvedName = extractPeerName(peer);
    const peerObj = {
      ...peer,
      name: resolvedName,
      friendUserName: resolvedName,
      userName: resolvedName
    };

    setCurrentPeer(peerObj);
    setMatchState('matched');

    // Subscribe to chat topic & send online status (matches Android ChatScreenViewModel init)
    if (socketService.isConnected) {
      socketService.subscribeChatTopic(peerObj.peerId || peerObj.id, peerObj.id || peerObj.conversationId);
      socketService.sendOnlineStatus(peerObj.id || peerObj.conversationId, true);
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
    setMessages(prev => [...prev, msg]);
    // Send seen receipt back to server
    if (socketService.isConnected && msg.id && currentPeer?.id) {
      socketService.sendSeen(msg.id, currentPeer.id);
    }
    if (soundEnabledRef.current && msg.senderId !== userRef.current?.id) playChime('message');
  }, [currentPeer]);

  const handleMatchFoundRef = useRef(handleMatchFound);
  const handleMessageReceivedRef = useRef(handleMessageReceived);
  useEffect(() => { handleMatchFoundRef.current = handleMatchFound; }, [handleMatchFound]);
  useEffect(() => { handleMessageReceivedRef.current = handleMessageReceived; }, [handleMessageReceived]);

  // Fallback engine initialization
  useEffect(() => {
    mockEngineRef.current = new MockMatchEngine(
      (peer) => handleMatchFoundRef.current(peer),
      (msg) => handleMessageReceivedRef.current(msg),
      (typing) => setIsPeerTyping(typing)
    );
  }, []);

  // Connect STOMP socket
  useEffect(() => {
    if (!jwtToken || !user?.id) {
      setConnectionStatus('disconnected');
      socketService.disconnect();
      return;
    }

    setConnectionStatus('connecting');

    socketService.connect(
      '/ws-chat',
      jwtToken,
      user.id,
      {
        onConnect: (sessionId) => {
          console.log('[SocketContext] STOMP connected, session:', sessionId);
          setConnectionStatus('connected');
        },
        onDisconnect: () => {
          console.log('[SocketContext] STOMP disconnected — using mock mode');
          setConnectionStatus('mock');
        },
        onMatchFound: (conversation) => {
          handleMatchFoundRef.current(conversation);
        },
        onMessageReceived: (msg) => {
          handleMessageReceivedRef.current(msg);
        },
        onTypingStatus: (typing) => {
          setIsPeerTyping(typing);
        },
        onPeerDisconnected: (disconnectedUser) => {
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
          }, 2500);
        },
        onError: (err) => {
          console.warn('[SocketContext] STOMP error:', err);
          setConnectionStatus('mock');
        }
      }
    );

    const connectionTimeout = setTimeout(() => {
      if (!socketService.isConnected) {
        console.log('[SocketContext] STOMP connection timeout — fallback to mock mode');
        setConnectionStatus('mock');
      }
    }, 4000);

    return () => {
      clearTimeout(connectionTimeout);
    };
  }, [jwtToken, user?.id]);

  useEffect(() => {
    return () => {
      socketService.disconnect();
    };
  }, []);

  const isLiveConnected = connectionStatus === 'connected' && socketService.isConnected;

  const startSearching = useCallback(() => {
    if (mockFallbackTimerRef.current) {
      clearTimeout(mockFallbackTimerRef.current);
      mockFallbackTimerRef.current = null;
    }
    mockEngineRef.current?.cancelSearch();

    setMatchState('searching');
    setCurrentPeer(null);
    setMessages([]);

    if (isLiveConnected) {
      socketService.findMatch(user, filters);
      mockFallbackTimerRef.current = setTimeout(() => {
        mockFallbackTimerRef.current = null;
        if (matchStateRef.current === 'searching') {
          console.log('[SocketContext] Server match timeout — fallback to mock match');
          mockEngineRef.current?.startSearching(filters);
        }
      }, 7000);
    } else {
      setConnectionStatus(prev => prev === 'connected' ? prev : 'mock');
      mockEngineRef.current?.startSearching(filters);
    }
  }, [isLiveConnected, user, filters]);

  const cancelSearch = useCallback(() => {
    if (mockFallbackTimerRef.current) {
      clearTimeout(mockFallbackTimerRef.current);
      mockFallbackTimerRef.current = null;
    }
    setMatchState('idle');
    if (mockEngineRef.current) mockEngineRef.current.cancelSearch();
  }, []);

  const skipStranger = useCallback(() => {
    if (mockFallbackTimerRef.current) {
      clearTimeout(mockFallbackTimerRef.current);
      mockFallbackTimerRef.current = null;
    }
    if (isLiveConnected && currentPeer) {
      socketService.skipPeer(currentPeer.peerId || currentPeer.id, currentPeer.id);
    }
    mockEngineRef.current?.cancelSearch();
    setCurrentPeer(null);
    setMessages([]);

    // Immediately start searching for next match
    setMatchState('searching');
    setTimeout(() => {
      if (isLiveConnected) {
        socketService.findMatch(user, filters);
        mockFallbackTimerRef.current = setTimeout(() => {
          mockFallbackTimerRef.current = null;
          if (matchStateRef.current === 'searching') {
            mockEngineRef.current?.startSearching(filters);
          }
        }, 7000);
      } else {
        mockEngineRef.current?.startSearching(filters);
      }
    }, 0);
  }, [isLiveConnected, currentPeer, user, filters]);

  const disconnectChat = useCallback(() => {
    if (mockFallbackTimerRef.current) {
      clearTimeout(mockFallbackTimerRef.current);
      mockFallbackTimerRef.current = null;
    }
    if (isLiveConnected && currentPeer) {
      socketService.skipPeer(currentPeer.peerId || currentPeer.id, currentPeer.id);
    }
    mockEngineRef.current?.cancelSearch();
    setCurrentPeer(null);
    setMatchState('idle');
    setMessages([]);
  }, [isLiveConnected, currentPeer]);

  const sendMessage = useCallback((text) => {
    if (!text.trim() || !currentPeer) return;

    const newMsg = {
      id: 'msg_' + Date.now(),
      senderId: user?.id || 'me',
      senderName: user?.name || user?.username || 'Me',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);

    if (isLiveConnected) {
      socketService.sendRandomChatMessage(text, currentPeer.peerId || currentPeer.id, currentPeer.id, user?.id);
    } else {
      mockEngineRef.current?.sendMessage(text);
    }

    if (isLiveConnected && currentPeer) {
      socketService.sendTyping(false, currentPeer.peerId || currentPeer.id, currentPeer.id, user?.id);
    }
  }, [isLiveConnected, currentPeer, user]);

  /**
   * Typing indicator notification with 1000ms debounce (matching Android typingDelayMillis = 1000L)
   */
  const notifyTyping = useCallback((isCurrentlyTyping) => {
    if (!isLiveConnected || !currentPeer) return;

    if (isCurrentlyTyping) {
      socketService.sendTyping(true, currentPeer.peerId || currentPeer.id, currentPeer.id, user?.id);

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socketService.sendTyping(false, currentPeer.peerId || currentPeer.id, currentPeer.id, user?.id);
      }, 1000);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      socketService.sendTyping(false, currentPeer.peerId || currentPeer.id, currentPeer.id, user?.id);
    }
  }, [isLiveConnected, currentPeer, user?.id]);

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
    const randomQ = ICEBREAKER_QUESTIONS[Math.floor(Math.random() * ICEBREAKER_QUESTIONS.length)];
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
