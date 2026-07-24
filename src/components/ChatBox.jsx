import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Send, SkipForward, UserPlus, LogOut, HelpCircle, Heart, Flame, Smile, Sparkles, Hand } from 'lucide-react';

export function ChatBox() {
  const { user, addFriend, friends } = useAuth();
  const {
    currentPeer,
    messages,
    isPeerTyping,
    sendMessage,
    sendReaction,
    sendIcebreaker,
    skipStranger,
    disconnectChat,
    floatingReactions,
    notifyTyping
  } = useSocket();

  const [inputMsg, setInputMsg] = useState('');
  const messagesEndRef = useRef(null);

  const isAlreadyFriend = friends.some(f => f.id === (currentPeer ? currentPeer.id : ''));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    sendMessage(inputMsg);
    setInputMsg('');
    // Stop typing indicator on send
    notifyTyping(false);
  };

  const handleInputChange = (e) => {
    setInputMsg(e.target.value);
    // Notify server that we're typing (debounced inside notifyTyping)
    if (e.target.value.trim().length > 0) {
      notifyTyping(true);
    } else {
      notifyTyping(false);
    }
  };

  if (!currentPeer) return null;

  return (
    <div className="glass-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Floating Animated Reactions */}
      {floatingReactions.map(r => (
        <div
          key={r.id}
          className="floating-reaction"
          style={{ left: r.left, bottom: '80px' }}
        >
          {r.emoji}
        </div>
      ))}

      {/* Top Header Bar */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(15, 17, 35, 0.4)'
      }}>
        {/* Peer Profile Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            backgroundColor: currentPeer.avatarBg || '#8b5cf6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            boxShadow: 'var(--shadow-glow)',
            overflow: 'hidden'
          }}>
            {currentPeer.photoUrl ? (
              <img
                src={currentPeer.photoUrl}
                alt={currentPeer.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              currentPeer.avatar || '⚡'
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{currentPeer.name}</h3>
              {currentPeer.country && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '10px' }}>
                  {currentPeer.country}
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {currentPeer.bio || 'Random Chat Partner'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isAlreadyFriend && (
            <button
              onClick={() => addFriend(currentPeer)}
              className="btn-cyan"
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
              title="Add to Friends"
            >
              <UserPlus size={16} />
              <span>Add Friend</span>
            </button>
          )}

          <button
            onClick={skipStranger}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <SkipForward size={16} />
            <span>Next Stranger</span>
          </button>

          <button
            onClick={disconnectChat}
            className="btn-danger"
            style={{ padding: '8px 12px' }}
            title="Leave Chat"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Interest Pills Sub-bar */}
      {currentPeer.interests && currentPeer.interests.length > 0 && (
        <div style={{
          padding: '8px 20px',
          background: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}>
          <span>Common Interests:</span>
          {currentPeer.interests.map(t => (
            <span key={t} style={{
              background: 'rgba(139, 92, 246, 0.2)',
              color: '#a78bfa',
              padding: '2px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem'
            }}>
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Messages Scroll Feed */}
      <div style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {messages.map(msg => {
          if (msg.senderId === 'system') {
            return (
              <div key={msg.id} style={{
                textAlign: 'center',
                margin: '12px 0',
                color: 'var(--cyan-accent)',
                fontSize: '0.85rem',
                fontStyle: 'italic'
              }}>
                {msg.text}
              </div>
            );
          }

          const isMe = user?.id && msg.senderId === user.id;

          return (
            <div
              key={msg.id}
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
                  ? 'linear-gradient(135deg, var(--primary-purple) 0%, #6366f1 100%)' 
                  : 'rgba(255, 255, 255, 0.08)',
                border: isMe ? 'none' : '1px solid var(--border-color)',
                color: '#ffffff',
                fontSize: '0.95rem',
                lineHeight: '1.4',
                boxShadow: isMe ? 'var(--shadow-glow)' : 'none'
              }}>
                {msg.text}
              </div>
              <span style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                marginTop: '4px',
                padding: '0 4px'
              }}>
                {msg.timestamp}
              </span>
            </div>
          );
        })}

        {/* Typing Indicator */}
        {isPeerTyping && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span>{currentPeer.name} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Bar: Icebreaker & Quick Reactions */}
      <div style={{
        padding: '8px 20px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(15, 17, 35, 0.3)'
      }}>
        {/* Icebreaker button */}
        <button
          onClick={sendIcebreaker}
          className="btn-secondary"
          style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: 'var(--radius-full)' }}
        >
          <HelpCircle size={14} color="var(--cyan-accent)" />
          <span>Ask Icebreaker</span>
        </button>

        {/* Quick Emojis */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { icon: <Heart size={16} color="#ec4899" />, emoji: '❤️' },
            { icon: <Flame size={16} color="#f97316" />, emoji: '🔥' },
            { icon: <Sparkles size={16} color="#eab308" />, emoji: '✨' },
            { icon: <Smile size={16} color="#06b6d4" />, emoji: '😂' },
            { icon: <Hand size={16} color="#a855f7" />, emoji: '👋' }
          ].map(item => (
            <button
              key={item.emoji}
              onClick={() => sendReaction(item.emoji)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                padding: '6px 10px',
                borderRadius: 'var(--radius-full)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
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

      {/* Text Message Input */}
      <form onSubmit={handleSend} style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(9, 10, 21, 0.7)'
      }}>
        <input
          type="text"
          value={inputMsg}
          onChange={handleInputChange}
          onBlur={() => notifyTyping(false)}
          placeholder={`Type a message to ${currentPeer.name}...`}
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
          className="btn-primary"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
