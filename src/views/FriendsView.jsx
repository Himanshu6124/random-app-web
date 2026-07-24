import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, UserMinus, Send, MessageCircle } from 'lucide-react';

export function FriendsView({ onStartMatch }) {
  const { friends, removeFriend } = useAuth();
  const [selectedFriend, setSelectedFriend] = useState(friends[0] || null);
  const [dmMessages, setDmMessages] = useState({});
  const [dmInput, setDmInput] = useState('');

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

    // Simulate friend auto reply
    setTimeout(() => {
      setDmMessages(prev => ({
        ...prev,
        [friendId]: [
          ...(prev[friendId] || []),
          {
            id: 'dm_reply_' + Date.now(),
            sender: selectedFriend.name,
            text: `Hey! Thanks for messaging! Let's match up again soon! 😊`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]
      }));
    }, 1500);
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
                      fontSize: '1.3rem'
                    }}>
                      {friend.avatar || '👤'}
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
                fontSize: '1.4rem'
              }}>
                {selectedFriend.avatar}
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedFriend.name}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--green-accent)' }}>● Active Now</span>
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
