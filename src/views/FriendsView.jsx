import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket, ICEBREAKER_QUESTIONS } from '../context/SocketContext';
import { socketService } from '../services/socketService';
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
  MoreVertical
} from 'lucide-react';
import { FriendRequestDialog } from '../components/FriendRequestDialog';

export function FriendsView({ onStartMatch }) {
  const {
    user,
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
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [dmInput, setDmInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Auto-select first friend on desktop if none selected
  useEffect(() => {
    if (!selectedFriend && friends.length > 0 && window.innerWidth > 768) {
      setSelectedFriend(friends[0]);
    }
  }, [friends]);

  // Load latest friends and pending requests from API on view mount
  useEffect(() => {
    loadFriendsFromApi();
    loadFriendRequests();
  }, []);

  // Load DM history from localStorage (keyed by friendId)
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

  // Auto-scroll on new messages or friend selection
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages, selectedFriend, isFriendTyping]);

  // Subscribe to STOMP friend chat topic & online status when selectedFriend changes
  useEffect(() => {
    if (!selectedFriend) return;

    const conversationId = selectedFriend.conversationId || selectedFriend.id;
    const friendId = selectedFriend.id || selectedFriend.friendUserId;

    if (isLiveConnected) {
      console.log(`[FriendsView] Subscribing to friend chat topic for ${selectedFriend.name}`);
      socketService.subscribeChatTopic(friendId, conversationId);
      socketService.sendOnlineStatus(conversationId, true);
    }

    return () => {
      if (isLiveConnected) {
        socketService.sendOnlineStatus(conversationId, false);
      }
    };
  }, [selectedFriend, isLiveConnected]);

  // Listen for incoming socket events (messages, typing)
  useEffect(() => {
    const prevMsgCb = socketService.callbacks.onMessageReceived;
    const prevTypingCb = socketService.callbacks.onTypingStatus;

    socketService.callbacks.onMessageReceived = (msg) => {
      const senderId = msg.senderId;
      const isFriendMsg = friends.some(f => f.id === senderId || f.friendUserId === senderId);

      if (isFriendMsg) {
        const friendId = senderId;
        const conversationId = msg.conversationId || friendId;
        
        setDmMessages(prev => ({
          ...prev,
          [friendId]: [
            ...(prev[friendId] || []),
            {
              id: msg.id || 'dm_' + Date.now(),
              sender: friendId,
              text: msg.text || msg.message || msg.content || '',
              time: msg.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]
        }));

        // Send seen receipt
        if (isLiveConnected && msg.id) {
          socketService.sendSeen(msg.id, conversationId);
        }
      }

      if (prevMsgCb) prevMsgCb(msg);
    };

    socketService.callbacks.onTypingStatus = (typing) => {
      setIsFriendTyping(Boolean(typing));
      if (prevTypingCb) prevTypingCb(typing);
    };

    return () => {
      socketService.callbacks.onMessageReceived = prevMsgCb;
      socketService.callbacks.onTypingStatus = prevTypingCb;
    };
  }, [friends, isLiveConnected]);

  // Handle opening friend chat (Friend Card click)
  const handleSelectFriend = (friend) => {
    setSelectedFriend(friend);
    setMobileShowChat(true);
    setIsFriendTyping(false);
    setShowMenu(false);
  };

  const handleSendDm = (e) => {
    if (e) e.preventDefault();
    if (!dmInput.trim() || !selectedFriend) return;

    const messageText = dmInput.trim();
    const friendId = selectedFriend.id || selectedFriend.friendUserId;
    const conversationId = selectedFriend.conversationId || friendId;

    const newMsg = {
      id: 'dm_' + Date.now(),
      sender: 'me',
      text: messageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setDmMessages(prev => ({
      ...prev,
      [friendId]: [...(prev[friendId] || []), newMsg]
    }));
    setDmInput('');

    // Clear typing status
    if (isLiveConnected) {
      socketService.sendTyping(false, friendId, conversationId, user?.id);
      socketService.sendMessage(messageText, friendId, user?.id, conversationId);
    }
  };

  const handleInputChange = (e) => {
    setDmInput(e.target.value);
    if (!selectedFriend || !isLiveConnected) return;

    const friendId = selectedFriend.id || selectedFriend.friendUserId;
    const conversationId = selectedFriend.conversationId || friendId;

    if (e.target.value.trim().length > 0) {
      socketService.sendTyping(true, friendId, conversationId, user?.id);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socketService.sendTyping(false, friendId, conversationId, user?.id);
      }, 1200);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      socketService.sendTyping(false, friendId, conversationId, user?.id);
    }
  };

  const handleIcebreakerClick = (e) => {
    e.preventDefault();
    if (!selectedFriend) return;
    const randomQ = ICEBREAKER_QUESTIONS[Math.floor(Math.random() * ICEBREAKER_QUESTIONS.length)];
    const text = `🧊 Icebreaker: ${randomQ}`;
    
    setDmInput(text);
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
    const friendId = selectedFriend.id || selectedFriend.friendUserId;
    const conversationId = selectedFriend.conversationId || friendId;
    const newMsg = {
      id: 'dm_' + Date.now(),
      sender: 'me',
      text: emoji,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setDmMessages(prev => ({
      ...prev,
      [friendId]: [...(prev[friendId] || []), newMsg]
    }));

    if (isLiveConnected) {
      socketService.sendMessage(emoji, friendId, user?.id, conversationId);
    }

    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== reactionObj.id));
    }, 1800);
  };

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
        className="glass-panel"
        style={{
          width: '320px',
          display: mobileShowChat ? 'none' : 'flex',
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
              const isSelected = selectedFriend && selectedFriend.id === friend.id;
              return (
                <div
                  key={friend.id}
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
                      <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{friend.name}</div>
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
      <div className="glass-panel" style={{
        flex: 1,
        display: (!mobileShowChat && window.innerWidth <= 768) ? 'none' : 'flex',
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
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedFriend.name}</h3>
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
                Direct conversation with <strong style={{ color: 'white' }}>{selectedFriend.name}</strong>
              </div>

              {(dmMessages[selectedFriend.id] || []).map(m => {
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
                  <span>{selectedFriend.name} is typing...</span>
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
                    const friendId = selectedFriend.id || selectedFriend.friendUserId;
                    const conversationId = selectedFriend.conversationId || friendId;
                    socketService.sendTyping(false, friendId, conversationId, user?.id);
                  }
                }}
                placeholder={`Message ${selectedFriend.name}...`}
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
