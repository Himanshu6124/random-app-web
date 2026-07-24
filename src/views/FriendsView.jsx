import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { socketService } from '../services/socketService';
import { Users, UserMinus, Send, MessageCircle, Wifi, WifiOff } from 'lucide-react';

export function FriendsView({ onStartMatch }) {
  const { user, friends, removeFriend } = useAuth();
  const { isLiveConnected, connectionStatus } = useSocket();
  const [selectedFriend, setSelectedFriend] = useState(friends[0] || null);
  const messagesEndRef = useRef(null);
  const [dmInput, setDmInput] = useState('');

  // Load DM history from localStorage (keyed by friendId)
  const [dmMessages, setDmMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('randomeet_dms') || '{}');
    } catch { return {}; }
  });

  // Persist DMs to localStorage on change
  useEffect(() => {
    localStorage.setItem('randomeet_dms', JSON.stringify(dmMessages));
  }, [dmMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages, selectedFriend]);

  // Listen for incoming socket messages that match a friend's id (DM)
  // SocketContext MESSAGE events with senderId === friend.id are captured here.
  // We do this by subscribing to socket events outside the match context.
  useEffect(() => {
    const originalCallback = socketService.callbacks.onMessageReceived;
    socketService.callbacks.onMessageReceived = (msg) => {
      // If a friend is sending us a message while we're not in a match, capture it
      const isFriendMsg = friends.some(f => f.id === msg.senderId);
      if (isFriendMsg) {
        const friendId = msg.senderId;
        setDmMessages(prev => ({
          ...prev,
          [friendId]: [
            ...(prev[friendId] || []),
            {
              id: msg.id,
              sender: friendId,
              text: msg.text,
              time: msg.timestamp
            }
          ]
        }));
      }
      // Still call original (match context) callback
      if (originalCallback) originalCallback(msg);
    };
    return () => {
      socketService.callbacks.onMessageReceived = originalCallback;
    };
  }, [friends]);

  const handleSendDm = (e) => {
    e.preventDefault();
    if (!dmInput.trim() || !selectedFriend) return;

    const friendId = selectedFriend.id;
    const newMsg = {
      id: 'dm_' + Date.now(),
      sender: 'me',
      text: dmInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setDmMessages(prev => ({
      ...prev,
      [friendId]: [...(prev[friendId] || []), newMsg]
    }));
    setDmInput('');

    // Send via real socket if connected
    if (isLiveConnected) {
      socketService.sendMessage(dmInput.trim(), friendId, user?.id);
    }
    // If offline, message is saved locally only
  };

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      height: '100%',
      gap: '16px',
      padding: '16px'
    }}>
      {/* Friends List Sidebar */}
      <div className="glass-panel" style={{
        width: '320px',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Users size={22} color="var(--primary-purple)" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>My Friends ({friends.length})</h2>
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
                  onClick={() => setSelectedFriend(friend)}
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
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: friend.avatarBg || '#ec4899',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.3rem',
                      overflow: 'hidden'
                    }}>
                      {friend.photoUrl ? (
                        <img src={friend.photoUrl} alt={friend.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none'; }} />
                      ) : (
                        friend.avatar || '👤'
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{friend.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {friend.status || 'Online'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFriend(friend.id);
                      if (selectedFriend && selectedFriend.id === friend.id) setSelectedFriend(null);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px'
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

      {/* Direct Chat Area */}
      <div className="glass-panel" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {selectedFriend ? (
          <>
            {/* Header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(15, 17, 35, 0.4)'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: selectedFriend.avatarBg || '#8b5cf6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                overflow: 'hidden'
              }}>
                {selectedFriend.photoUrl ? (
                  <img src={selectedFriend.photoUrl} alt={selectedFriend.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none'; }} />
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

            {/* Direct Message Feed */}
            <div style={{
              flex: 1,
              padding: '24px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', margin: '16px 0' }}>
                Encrypted Direct Messages with {selectedFriend.name}
              </div>

              {(dmMessages[selectedFriend.id] || []).map(m => {
                const isMe = m.sender === 'me';
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div style={{
                      maxWidth: '70%',
                      padding: '12px 18px',
                      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isMe 
                        ? 'linear-gradient(135deg, var(--cyan-accent) 0%, #0284c7 100%)' 
                        : 'rgba(255, 255, 255, 0.08)',
                      color: 'white',
                      fontSize: '0.95rem'
                    }}>
                      {m.text}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {m.time}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* DM Input Form */}
            <form onSubmit={handleSendDm} style={{
              padding: '16px 20px',
              display: 'flex',
              gap: '12px',
              borderTop: '1px solid var(--border-color)',
              background: 'rgba(9, 10, 21, 0.6)'
            }}>
              <input
                type="text"
                value={dmInput}
                onChange={(e) => setDmInput(e.target.value)}
                placeholder={`Message ${selectedFriend.name}...`}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'white',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                className="btn-cyan"
                style={{ width: '46px', height: '46px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Send size={18} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>
            <MessageCircle size={48} color="var(--primary-purple)" style={{ marginBottom: '16px' }} />
            <p>Select a friend from the left sidebar to chat directly!</p>
          </div>
        )}
      </div>
    </div>
  );
}
