import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  const { user, soundEnabled } = useAuth();
  
  const [matchState, setMatchState] = useState('idle');
  const [currentPeer, setCurrentPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [useLiveSocket, setUseLiveSocket] = useState(false);
  const [serverUrl, setServerUrl] = useState('wss://randomchat.qz.io/ws-chat');
  const [authToken, setAuthToken] = useState('');
  const [floatingReactions, setFloatingReactions] = useState([]);

  const [filters, setFilters] = useState({
    gender: 'All',
    interests: []
  });

  const mockEngineRef = useRef(null);

  useEffect(() => {
    mockEngineRef.current = new MockMatchEngine(
      (peer) => handleMatchFound(peer),
      (msg) => handleMessageReceived(msg),
      (typing) => setIsPeerTyping(typing)
    );
  }, []);

  // Socket Connection Handler matching SocketRepository.android.kt
  useEffect(() => {
    if (useLiveSocket) {
      socketService.connect(serverUrl, authToken, {
        onConnect: (sessionId) => {
          console.log('[SocketContext] STOMP Socket connected with session:', sessionId);
        },
        onDisconnect: () => {
          console.log('[SocketContext] STOMP Socket disconnected');
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
        },
        onError: (err) => {
          console.warn('[SocketContext] STOMP error:', err);
        }
      });
    } else {
      socketService.disconnect();
    }
  }, [useLiveSocket, serverUrl, authToken]);

  const handleMatchFound = (peer) => {
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
  };

  const handleMessageReceived = (msg) => {
    setMessages(prev => [...prev, msg]);
    if (soundEnabled && msg.senderId !== user.id) playChime('message');
  };

  const startSearching = () => {
    setMatchState('searching');
    setCurrentPeer(null);
    setMessages([]);

    if (useLiveSocket && socketService.isConnected) {
      socketService.findMatch(user, filters);
    } else {
      mockEngineRef.current.startSearching(filters);
    }
  };

  const cancelSearch = () => {
    setMatchState('idle');
    if (mockEngineRef.current) mockEngineRef.current.cancelSearch();
  };

  const skipStranger = () => {
    if (useLiveSocket && socketService.isConnected && currentPeer) {
      socketService.skipPeer(currentPeer.id);
    }
    cancelSearch();
    startSearching();
  };

  const disconnectChat = () => {
    if (useLiveSocket && socketService.isConnected && currentPeer) {
      socketService.skipPeer(currentPeer.id);
    }
    cancelSearch();
    setCurrentPeer(null);
    setMatchState('idle');
  };

  const sendMessage = (text) => {
    if (!text.trim() || !currentPeer) return;

    const newMsg = {
      id: 'msg_' + Date.now(),
      senderId: user.id,
      senderName: user.name,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);

    if (useLiveSocket && socketService.isConnected) {
      socketService.sendMessage(text, currentPeer.id);
    } else {
      mockEngineRef.current.sendMessage(text);
    }
  };

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
      floatingReactions,
      useLiveSocket,
      setUseLiveSocket,
      serverUrl,
      setServerUrl,
      authToken,
      setAuthToken
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
