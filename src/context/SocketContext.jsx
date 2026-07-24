import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { socketService } from '../services/socketService';
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

  const [matchState, setMatchState] = useState('idle');
  const [currentPeer, setCurrentPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);

  // Connection mode: 'connecting' | 'connected' | 'mock' | 'disconnected'
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const [filters, setFilters] = useState({
    gender: 'All',
    interests: []
  });

  const mockEngineRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Initialize mock engine as fallback
  useEffect(() => {
    mockEngineRef.current = new MockMatchEngine(
      (peer) => handleMatchFound(peer),
      (msg) => handleMessageReceived(msg),
      (typing) => setIsPeerTyping(typing)
    );
  }, []);

  // Auto-connect real STOMP socket when JWT is available
  useEffect(() => {
    if (!jwtToken || !user?.id) {
      setConnectionStatus('disconnected');
      socketService.disconnect();
      return;
    }

    setConnectionStatus('connecting');

    socketService.connect(
      '/ws-chat', // routed through Vite proxy to 192.168.1.7:8080/ws-chat
      jwtToken,
      user.id,
      {
        onConnect: (sessionId) => {
          console.log('[SocketContext] STOMP connected, session:', sessionId);
          setConnectionStatus('connected');
        },
        onDisconnect: () => {
          console.log('[SocketContext] STOMP disconnected — falling back to mock');
          setConnectionStatus('mock');
        },
        onMatchFound: (conversation) => {
          handleMatchFound(conversation);
        },
        onMessageReceived: (msg) => {
          handleMessageReceived(msg);
        },
        onTypingStatus: (typing) => {
          setIsPeerTyping(typing);
        },
        onPeerDisconnected: (disconnectedUser) => {
          setMessages(prev => [
            ...prev,
            {
              id: 'sys_' + Date.now(),
              senderId: 'system',
              text: `${disconnectedUser || 'Stranger'} has disconnected from the chat.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          // Auto-return to idle after peer disconnects
          setTimeout(() => {
            setMatchState('idle');
            setCurrentPeer(null);
          }, 3000);
        },
        onError: (err) => {
          console.warn('[SocketContext] STOMP error:', err);
          setConnectionStatus('mock');
        }
      }
    );

    // Detect if STOMP connected within 4s, otherwise assume mock mode
    const connectionTimeout = setTimeout(() => {
      if (!socketService.isConnected) {
        console.log('[SocketContext] STOMP connection timed out — using mock mode');
        setConnectionStatus('mock');
      }
    }, 4000);

    return () => {
      clearTimeout(connectionTimeout);
    };
  }, [jwtToken, user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleMatchFound = useCallback((peer) => {
    setCurrentPeer(peer);
    setMatchState('matched');
    setMessages([
      {
        id: 'sys_' + Date.now(),
        senderId: 'system',
        text: `You are now connected with ${peer.name}! Say hi!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    if (soundEnabled) playChime('match');
  }, [soundEnabled]);

  const handleMessageReceived = useCallback((msg) => {
    setMessages(prev => [...prev, msg]);
    if (soundEnabled && msg.senderId !== user?.id) playChime('message');
  }, [soundEnabled, user?.id]);

  const isLiveConnected = connectionStatus === 'connected' && socketService.isConnected;

  const startSearching = () => {
    setMatchState('searching');
    setCurrentPeer(null);
    setMessages([]);

    if (isLiveConnected) {
      socketService.findMatch(user, filters);
    } else {
      // Mock fallback
      setConnectionStatus(prev => prev === 'connected' ? prev : 'mock');
      mockEngineRef.current?.startSearching(filters);
    }
  };

  const cancelSearch = () => {
    setMatchState('idle');
    if (mockEngineRef.current) mockEngineRef.current.cancelSearch();
  };

  const skipStranger = () => {
    if (isLiveConnected && currentPeer) {
      socketService.skipPeer(currentPeer.id);
    }
    if (mockEngineRef.current) mockEngineRef.current.cancelSearch();
    setCurrentPeer(null);
    setMessages([]);
    startSearching();
  };

  const disconnectChat = () => {
    if (isLiveConnected && currentPeer) {
      socketService.skipPeer(currentPeer.id);
    }
    if (mockEngineRef.current) mockEngineRef.current.cancelSearch();
    setCurrentPeer(null);
    setMatchState('idle');
    setMessages([]);
  };

  const sendMessage = (text) => {
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
      socketService.sendMessage(text, currentPeer.id, user?.id);
    } else {
      mockEngineRef.current?.sendMessage(text);
    }

    // Clear typing after send
    if (isLiveConnected && currentPeer) {
      socketService.sendTyping(false, currentPeer.id, user?.id);
    }
  };

  /**
   * Called on every input keypress — sends typing=true to server with debounce.
   * Typing=false sent after 1.5s of inactivity or when message sent.
   */
  const notifyTyping = useCallback((isCurrentlyTyping) => {
    if (!isLiveConnected || !currentPeer) return;

    if (isCurrentlyTyping) {
      socketService.sendTyping(true, currentPeer.id, user?.id);

      // Reset the idle timer
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socketService.sendTyping(false, currentPeer.id, user?.id);
      }, 1500);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      socketService.sendTyping(false, currentPeer.id, user?.id);
    }
  }, [isLiveConnected, currentPeer, user?.id]);

  const sendReaction = (emoji) => {
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
  };

  const sendIcebreaker = () => {
    const randomQ = ICEBREAKER_QUESTIONS[Math.floor(Math.random() * ICEBREAKER_QUESTIONS.length)];
    sendMessage(`🧊 Icebreaker: ${randomQ}`);
  };

  const toggleInterestFilter = (tag) => {
    setFilters(prev => {
      const exists = prev.interests.includes(tag);
      const updated = exists
        ? prev.interests.filter(t => t !== tag)
        : [...prev.interests, tag];
      return { ...prev, interests: updated };
    });
  };

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
