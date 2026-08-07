import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket, ICEBREAKER_QUESTIONS } from '../context/SocketContext';
import { socketService } from '../services/socketService';
import { authService } from '../services/authService';
import {
  Users,
  UserMinus,
  UserPlus,
  Send,
  MessageCircle,
  ArrowLeft,
  HelpCircle,
  Heart,
  Flame,
  Sparkles,
  Smile,
  Hand,
  MoreVertical,
  Loader2
} from 'lucide-react';
import { FriendRequestDialog } from '../components/FriendRequestDialog';

export function FriendsView({ onStartMatch }) {
  const {
    user,
    jwtToken,
    friends,
    removeFriend,
    friendRequests,
    friendRequestsLoading,
    loadFriendRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    loadFriendsFromApi
  } = useAuth();

  const { isLiveConnected } = useSocket();
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [dmInput, setDmInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [fetchingMessages, setFetchingMessages] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Dynamic window resize listener for instant mobile/desktop adaptation
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-select first friend on desktop if none selected
  useEffect(() => {
    if (!selectedFriend && friends.length > 0 && !isMobile) {
      setSelectedFriend(friends[0]);
    }
  }, [friends, isMobile]);

  // Load latest friends and pending requests from API on view mount
  useEffect(() => {
    loadFriendsFromApi();
    loadFriendRequests();
  }, []);

  // Load DM history from localStorage (keyed by friendUserId/id)
  const [dmMessages, setDmMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('randomeet_dms') || '{}');
    } catch {
      return {};
    }
  });

  // Persist DMs to localStorage on change
  useEffect(() => {
    localStorage.setItem('randomeet_dms', JSON.stringify(dmMessages));
  }, [dmMessages]);

  // Fetch existing chat history from backend API when opening a friend card
  useEffect(() => {
    if (!selectedFriend) return;

    const conversationId = selectedFriend.conversationId || selectedFriend.id;
    const friendUserId = selectedFriend.friendUserId || selectedFriend.peerId || selectedFriend.id;
    const token = jwtToken || authService.getToken();

    if (!conversationId || !token) return;

    let isSubscribed = true;
    setFetchingMessages(true);

    console.log(`[FriendsView] Fetching existing chat history for conversation ${conversationId} (friendUserId: ${friendUserId})`);
    authService.fetchConversationMessages(conversationId, token)
      .then(apiMessages => {
        if (!isSubscribed) return;
        if (Array.isArray(apiMessages) && apiMessages.length > 0) {
          setDmMessages(prev => {
            const existingLocal = prev[friendUserId] || prev[selectedFriend.id] || [];
            const mergedMap = new Map();
            // Add fetched API messages first
            apiMessages.forEach(m => mergedMap.set(m.id, m));
            // Keep any local unsaved/unique messages
            existingLocal.forEach(m => {
              if (!mergedMap.has(m.id)) mergedMap.set(m.id, m);
            });
            return {
              ...prev,
              [friendUserId]: Array.from(mergedMap.values()),
              [selectedFriend.id]: Array.from(mergedMap.values())
            };
          });
        }
      })
      .catch(err => {
        console.warn('[FriendsView] Failed to load chat history from API:', err);
      })
      .finally(() => {
        if (isSubscribed) setFetchingMessages(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [selectedFriend?.id, selectedFriend?.conversationId, jwtToken]);

  // Auto-scroll on new messages or friend selection
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages, selectedFriend, isFriendTyping]);

  // Subscribe to STOMP friend chat topics & online status when selectedFriend changes
  useEffect(() => {
    if (!selectedFriend) return;

    const conversationId = selectedFriend.conversationId || selectedFriend.id;
    const friendUserId = selectedFriend.friendUserId || selectedFriend.peerId || selectedFriend.id;
    const myId = user?.id || authService.getUserId();

    if (isLiveConnected) {
      console.log(`[FriendsView] Subscribing to chat topics: friendUserId=${friendUserId}, convId=${conversationId}, myUserId=${myId}`);
      socketService.subscribeChatTopic(friendUserId, conversationId, myId);
      socketService.sendOnlineStatus(conversationId, true);
    }

    return () => {
      if (isLiveConnected && conversationId) {
        socketService.sendOnlineStatus(conversationId, false);
      }
    };
  }, [selectedFriend, isLiveConnected, user?.id]);

  // Listen for incoming socket events (messages, typing, online status)
  useEffect(() => {
    const prevMsgCb = socketService.callbacks.onMessageReceived;
    const prevTypingCb = socketService.callbacks.onTypingStatus;
    const prevOnlineCb = socketService.callbacks.onOnlineStatus;

    socketService.callbacks.onMessageReceived = (msg) => {
      console.log('[FriendsView] Incoming socket message:', msg);
      const senderId = String(msg.senderId || '');
      const myId = String(user?.id || authService.getUserId() || '');

      // Ignore our own sent messages if echoed back by server
      if (senderId && senderId === myId) {
        console.log('[FriendsView] Ignoring self-echo message');
        return;
      }

      const activeFriendUserId = selectedFriend
        ? String(selectedFriend.friendUserId || selectedFriend.peerId || selectedFriend.id || '')
        : '';
      const activeConvId = selectedFriend
        ? String(selectedFriend.conversationId || selectedFriend.id || '')
        : '';

      const isFriendMsg = (
        (activeFriendUserId && senderId === activeFriendUserId) ||
        (activeConvId && String(msg.conversationId) === activeConvId) ||
        friends.some(f =>
          String(f.id) === senderId ||
          String(f.friendUserId) === senderId ||
          (f.username && String(f.username) === senderId)
        )
      );

      if (isFriendMsg) {
        const friendKey = activeFriendUserId || senderId;
        console.log(`[FriendsView] Appending incoming message to friend key ${friendKey}`);

        setDmMessages(prev => {
          const currentList = prev[friendKey] || [];
          if (msg.id && currentList.some(m => m.id === msg.id)) return prev;

          const updatedList = [
            ...currentList,
            {
              id: msg.id || 'dm_' + Date.now(),
              sender: friendKey,
              text: msg.text || msg.message || msg.content || '',
              time: msg.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ];

          return {
            ...prev,
            [friendKey]: updatedList,
            [selectedFriend?.id]: updatedList
          };
        });

        // Send seen receipt back to server
        if (isLiveConnected && msg.id) {
          socketService.sendSeen(msg.id, msg.conversationId || activeConvId);
        }
      }

      if (prevMsgCb) prevMsgCb(msg);
    };

    socketService.callbacks.onTypingStatus = (typing, payload) => {
      console.log('[FriendsView] Incoming typing status event:', typing, payload);
      const senderId = String(payload?.senderId || '');
      const myId = String(user?.id || authService.getUserId() || '');

      // Ignore my own typing notification echoes
      if (senderId && senderId === myId) {
        return;
      }

      setIsFriendTyping(Boolean(typing));
      if (prevTypingCb) prevTypingCb(typing, payload);
    };

    socketService.callbacks.onOnlineStatus = (isOnline, payload) => {
      console.log('[FriendsView] Incoming online status event:', isOnline, payload);
      const senderId = String(payload?.senderId || '');
      const myId = String(user?.id || authService.getUserId() || '');

      if (senderId && senderId === myId) return;

      if (selectedFriend && (
        String(selectedFriend.id) === senderId ||
        String(selectedFriend.friendUserId) === senderId ||
        payload?.conversationId === (selectedFriend.conversationId || selectedFriend.id)
      )) {
        setSelectedFriend(prev => prev ? { ...prev, isOnline: Boolean(isOnline) } : null);
      }

      if (prevOnlineCb) prevOnlineCb(isOnline, payload);
    };

    return () => {
      socketService.callbacks.onMessageReceived = prevMsgCb;
      socketService.callbacks.onTypingStatus = prevTypingCb;
      socketService.callbacks.onOnlineStatus = prevOnlineCb;
    };
  }, [friends, selectedFriend, isLiveConnected, user?.id]);

  // Handle opening friend chat (Friend Card click)
  const handleSelectFriend = (friend) => {
    console.log('[FriendsView] Friend card clicked:', friend);
    setSelectedFriend(friend);
    setMobileShowChat(true);
    setIsFriendTyping(false);
    setShowMenu(false);
  };

  const handleSendDm = (e) => {
    if (e) e.preventDefault();
    if (!dmInput.trim() || !selectedFriend) return;

    const messageText = dmInput.trim();
    const friendUserId = selectedFriend.friendUserId || selectedFriend.peerId || selectedFriend.id;
    const conversationId = selectedFriend.conversationId || selectedFriend.id;
    const myId = user?.id || authService.getUserId();

    const newMsg = {
      id: 'dm_' + Date.now(),
      sender: 'me',
      text: messageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setDmMessages(prev => ({
      ...prev,
      [friendUserId]: [...(prev[friendUserId] || []), newMsg],
      [selectedFriend.id]: [...(prev[selectedFriend.id] || []), newMsg]
    }));
    setDmInput('');

    // Send via socket & clear typing status
    if (isLiveConnected) {
      console.log(`[FriendsView] Sending DM via socket to friendUserId=${friendUserId}, convId=${conversationId}`);
      socketService.sendTyping(false, friendUserId, conversationId, myId);
      socketService.sendMessage(messageText, friendUserId, myId, conversationId);
    }
  };

  const handleInputChange = (e) => {
    setDmInput(e.target.value);
    if (!selectedFriend || !isLiveConnected) return;

    const friendUserId = selectedFriend.friendUserId || selectedFriend.peerId || selectedFriend.id;
    const conversationId = selectedFriend.conversationId || selectedFriend.id;
    const myId = user?.id || authService.getUserId();

    if (e.target.value.trim().length > 0) {
      socketService.sendTyping(true, friendUserId, conversationId, myId);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socketService.sendTyping(false, friendUserId, conversationId, myId);
      }, 1200);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      socketService.sendTyping(false, friendUserId, conversationId, myId);
    }
  };

  const handleIcebreakerClick = (e) => {
    e.preventDefault();
    if (!selectedFriend) return;
    console.log('[FriendsView] Icebreaker button clicked for friend:', selectedFriend);
    const randomQ = ICEBREAKER_QUESTIONS[Math.floor(Math.random() * ICEBREAKER_QUESTIONS.length)];
    setDmInput(`🧊 Icebreaker: ${randomQ}`);
  };

  const handleReactionClick = (e, emoji) => {
    e.preventDefault();
    if (!selectedFriend) return;

    const reactionObj = {
      id: 'react_' + Date.now() + Math.random(),
      emoji,
      left: Math.random() * 60 + 20 + '%'
    };
    setFloatingReactions(prev => [...prev, reactionObj]);

    // Send emoji as message
    const friendUserId = selectedFriend.friendUserId || selectedFriend.peerId || selectedFriend.id;
    const conversationId = selectedFriend.conversationId || selectedFriend.id;
    const myId = user?.id || authService.getUserId();

    const newMsg = {
      id: 'dm_' + Date.now(),
      sender: 'me',
      text: emoji,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setDmMessages(prev => ({
      ...prev,
      [friendUserId]: [...(prev[friendUserId] || []), newMsg],
      [selectedFriend.id]: [...(prev[selectedFriend.id] || []), newMsg]
    }));

    if (isLiveConnected) {
      socketService.sendMessage(emoji, friendUserId, myId, conversationId);
    }

    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== reactionObj.id));
    }, 1800);
  };

  const currentFriendKey = selectedFriend ? (selectedFriend.friendUserId || selectedFriend.id) : null;
  const currentMessages = currentFriendKey ? (dmMessages[currentFriendKey] || dmMessages[selectedFriend.id] || []) : [];

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      height: '100%',
      gap: '16px',
      padding: '16px',
      position: 'relative'
    }}>
      {/* Sidebar: Friends List */}
      <div
        className="glass-panel friends-sidebar"
        style={{
          width: isMobile ? '100%' : '320px',
          display: (isMobile && mobileShowChat) ? 'none' : 'flex',
          flexDirection: 'column',
          padding: '20px',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={22} color="var(--primary-purple)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>My Friends ({friends.length})</h2>
          </div>

          <button
            onClick={() => {
              loadFriendRequests();
              setShowRequestDialog(true);
            }}
            className="btn-cyan"
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
            title="Friend Requests"
          >
            <UserPlus size={15} />
            <span>Requests</span>
            {friendRequests.length > 0 && (
              <span style={{
                backgroundColor: '#FF3B30',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '10px',
                marginLeft: '2px'
              }}>
                {friendRequests.length}
              </span>
            )}
          </button>
        </div>

        {friends.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
            <p>No friends added yet!</p>
            <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>Match with strangers and add them to your friends list!</p>
            <button
              onClick={onStartMatch}
              className="btn-primary"
              style={{ marginTop: '16px', padding: '10px 20px', fontSize: '0.85rem' }}
            >
              Start Matching
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
            {friends.map(friend => {
              const isSelected = selectedFriend && (selectedFriend.id === friend.id || selectedFriend.friendUserId === friend.friendUserId);
              return (
                <div
                  key={friend.id || friend.friendUserId}
                  onClick={() => handleSelectFriend(friend)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: isSelected ? '1px solid var(--primary-purple)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: friend.avatarBg || '#ec4899',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.3rem',
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      {friend.photoUrl ? (
                        <img src={friend.photoUrl} alt={friend.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        friend.avatar || '👤'
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{friend.name || friend.friendUserName}</div>
                      <div style={{ fontSize: '0.75rem', color: isLiveConnected ? 'var(--green-accent)' : 'var(--text-muted)' }}>
                        {friend.status || 'Tap to chat'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFriend(friend.id);
                      if (selectedFriend && selectedFriend.id === friend.id) {
                        setSelectedFriend(null);
                        setMobileShowChat(false);
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '6px'
                    }}
                    title="Remove Friend"
                  >
                    <UserMinus size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Area: Direct Chat Screen */}
      <div className="glass-panel friends-chat-area" style={{
        flex: 1,
        display: (isMobile && !mobileShowChat) ? 'none' : 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Floating Animated Reactions */}
        {floatingReactions.map(r => (
          <div
            key={r.id}
            className="floating-reaction"
            style={{ left: r.left, bottom: '80px', zIndex: 100 }}
          >
            {r.emoji}
          </div>
        ))}

        {selectedFriend ? (
          <>
            {/* Top Bar Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 17, 35, 0.4)',
              zIndex: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Back button on mobile viewports */}
                <button
                  onClick={() => setMobileShowChat(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px'
                  }}
                  title="Back to Friends List"
                >
                  <ArrowLeft size={20} />
                </button>

                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: selectedFriend.avatarBg || '#8b5cf6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-glow)'
                }}>
                  {selectedFriend.photoUrl ? (
                    <img src={selectedFriend.photoUrl} alt={selectedFriend.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    selectedFriend.avatar || '👤'
                  )}
                </div>

                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedFriend.name || selectedFriend.friendUserName}</h3>
                  <span style={{ fontSize: '0.8rem', color: isLiveConnected ? 'var(--green-accent)' : 'var(--text-muted)' }}>
                    {isLiveConnected ? '● Live Chat' : '● Local Only'}
                  </span>
                </div>
              </div>

              {/* Options Menu */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowMenu(prev => !prev)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '6px'
                  }}
                >
                  <MoreVertical size={20} />
                </button>

                {showMenu && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '36px',
                    backgroundColor: '#1e1b4b',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    padding: '6px 0',
                    width: '160px',
                    zIndex: 50
                  }}>
                    <button
                      onClick={() => {
                        removeFriend(selectedFriend.id);
                        setSelectedFriend(null);
                        setMobileShowChat(false);
                        setShowMenu(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <UserMinus size={15} />
                      Remove Friend
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Direct Messages Log */}
            <div style={{
              flex: 1,
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              zIndex: 10
            }}>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', margin: '12px 0' }}>
                Direct conversation with <strong style={{ color: 'white' }}>{selectedFriend.name || selectedFriend.friendUserName}</strong>
              </div>

              {/* Loading indicator when fetching chat history */}
              {fetchingMessages && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: 'var(--cyan-accent)',
                  fontSize: '0.82rem',
                  padding: '8px'
                }}>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Loading existing messages...</span>
                </div>
              )}

              {currentMessages.map(m => {
                const isMe = m.sender === 'me';
                return (
                  <div
                    key={m.id}
                    className="animate-fade-in"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div style={{
                      maxWidth: '75%',
                      padding: '12px 18px',
                      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isMe
                        ? 'linear-gradient(135deg, var(--cyan-accent) 0%, #0284c7 100%)'
                        : 'rgba(255, 255, 255, 0.08)',
                      border: isMe ? 'none' : '1px solid var(--border-color)',
                      color: 'white',
                      fontSize: '0.95rem',
                      lineHeight: '1.4'
                    }}>
                      {m.text}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', padding: '0 4px' }}>
                      {m.time}
                    </span>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isFriendTyping && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <span>{selectedFriend.name || selectedFriend.friendUserName} is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions Sub-bar (Icebreaker & Reactions) */}
            <div style={{
              padding: '8px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 17, 35, 0.5)',
              zIndex: 20
            }}>
              <button
                type="button"
                onClick={handleIcebreakerClick}
                className="btn-secondary"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  borderRadius: 'var(--radius-full)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <HelpCircle size={14} color="var(--cyan-accent)" />
                <span style={{ fontWeight: 600 }}>Ask Icebreaker</span>
              </button>

              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { icon: <Heart size={15} color="#ec4899" />, emoji: '❤️' },
                  { icon: <Flame size={15} color="#f97316" />, emoji: '🔥' },
                  { icon: <Sparkles size={15} color="#eab308" />, emoji: '✨' },
                  { icon: <Smile size={15} color="#06b6d4" />, emoji: '😂' },
                  { icon: <Hand size={15} color="#a855f7" />, emoji: '👋' }
                ].map(item => (
                  <button
                    key={item.emoji}
                    type="button"
                    onClick={(e) => handleReactionClick(e, item.emoji)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-full)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {item.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* DM Text Input Form */}
            <form onSubmit={handleSendDm} style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(9, 10, 21, 0.8)',
              zIndex: 20
            }}>
              <input
                type="text"
                value={dmInput}
                onChange={handleInputChange}
                onBlur={() => {
                  if (selectedFriend && isLiveConnected) {
                    const friendUserId = selectedFriend.friendUserId || selectedFriend.peerId || selectedFriend.id;
                    const conversationId = selectedFriend.conversationId || selectedFriend.id;
                    const myId = user?.id || authService.getUserId();
                    socketService.sendTyping(false, friendUserId, conversationId, myId);
                  }
                }}
                placeholder={`Message ${selectedFriend.name || selectedFriend.friendUserName}...`}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'white',
                  fontSize: '0.95rem',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                className="btn-cyan"
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Send size={18} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>
            <MessageCircle size={48} color="var(--primary-purple)" style={{ marginBottom: '16px' }} />
            <p style={{ fontSize: '1rem', fontWeight: 600 }}>Select a friend to start chatting!</p>
            <p style={{ fontSize: '0.8rem', marginTop: '6px', opacity: 0.8 }}>Choose a friend from the left sidebar to send direct messages.</p>
          </div>
        )}
      </div>

      {/* Friend Requests Modal Dialog */}
      {showRequestDialog && (
        <FriendRequestDialog
          friendRequests={friendRequests}
          isLoading={friendRequestsLoading}
          onDismiss={() => setShowRequestDialog(false)}
          onAccept={async (reqId) => {
            await acceptFriendRequest(reqId);
          }}
          onReject={async (reqId) => {
            await rejectFriendRequest(reqId);
          }}
        />
      )}
    </div>
  );
}
