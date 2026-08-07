import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Send, SkipForward, UserPlus, UserCheck, LogOut, HelpCircle, Heart, Flame, Smile, Sparkles, Hand } from 'lucide-react';
import { extractPeerName } from '../services/socketService';

export function ChatBox() {
  const { user, addFriend, sendFriendRequest, friends } = useAuth();
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
  const [requestSent, setRequestSent] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const messagesEndRef = useRef(null);

  const peerName = extractPeerName(currentPeer);
  const peerId = currentPeer ? (currentPeer.peerId || currentPeer.friendUserId || currentPeer.id || currentPeer.username) : '';
  const isAlreadyFriend = friends.some(f => (f.id === peerId || f.friendUserId === peerId || f.username === peerId));

  // Reset requestSent state whenever peer changes
  useEffect(() => {
    setRequestSent(false);
  }, [peerId]);

  const handleAddFriendClick = async () => {
    if (!peerId || sendingRequest || requestSent) return;
    setSendingRequest(true);
    try {
      await sendFriendRequest(peerId);
      setRequestSent(true);
    } catch (err) {
      console.warn("Failed to send friend request via API, fallback to addFriend:", err);
      try {
        await addFriend({ ...currentPeer, name: peerName });
        setRequestSent(true);
      } catch (e) {}
    } finally {
      setSendingRequest(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    sendMessage(inputMsg);
    setInputMsg('');
    notifyTyping(false);
  };

  const handleInputChange = (e) => {
    setInputMsg(e.target.value);
    if (e.target.value.trim().length > 0) {
      notifyTyping(true);
    } else {
      notifyTyping(false);
    }
  };

  const handleIcebreakerClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[ChatBox] Icebreaker button clicked');
    sendIcebreaker();
  };

  const handleReactionClick = (e, emoji) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[ChatBox] Reaction clicked:', emoji);
    sendReaction(emoji);
  };

  if (!currentPeer) return null;

  return (
    <div className="glass-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      position: 'relative',
      overflow: 'hidden',
      zIndex: 5
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
        background: 'rgba(15, 17, 35, 0.4)',
        position: 'relative',
        zIndex: 10
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
                alt={peerName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              currentPeer.avatar || '⚡'
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{peerName}</h3>
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
              type="button"
              onClick={handleAddFriendClick}
              disabled={requestSent || sendingRequest}
              className="btn-cyan"
              style={{
                padding: '8px 14px',
                fontSize: '0.85rem',
                cursor: (requestSent || sendingRequest) ? 'default' : 'pointer',
                opacity: requestSent ? 0.85 : 1,
                background: requestSent ? 'rgba(52, 199, 89, 0.2)' : undefined,
                borderColor: requestSent ? '#34C759' : undefined
              }}
              title={requestSent ? "Friend Request Sent" : "Add to Friends"}
            >
              {requestSent ? (
                <>
                  <UserCheck size={16} color="#34C759" />
                  <span style={{ color: '#34C759', fontWeight: 600 }}>Request Sent</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>{sendingRequest ? 'Sending...' : 'Add Friend'}</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={skipStranger}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            <SkipForward size={16} />
            <span>Next Stranger</span>
          </button>

          <button
            type="button"
            onClick={disconnectChat}
            className="btn-danger"
            style={{ padding: '8px 12px', cursor: 'pointer' }}
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
          color: 'var(--text-muted)',
          position: 'relative',
          zIndex: 10
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
        gap: '12px',
        position: 'relative',
        zIndex: 10
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
            <span>{peerName} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Bar: Icebreaker & Quick Reactions */}
      <div style={{
        padding: '10px 20px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(15, 17, 35, 0.5)',
        position: 'relative',
        zIndex: 20
      }}>
        {/* Icebreaker button */}
        <button
          type="button"
          onClick={handleIcebreakerClick}
          className="btn-secondary"
          style={{
            padding: '8px 16px',
            fontSize: '0.82rem',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            position: 'relative',
            zIndex: 30,
            pointerEvents: 'auto'
          }}
        >
          <HelpCircle size={15} color="var(--cyan-accent)" />
          <span style={{ fontWeight: 600 }}>Ask Icebreaker</span>
        </button>

        {/* Quick Emojis */}
        <div style={{ display: 'flex', gap: '6px', position: 'relative', zIndex: 30 }}>
          {[
            { icon: <Heart size={16} color="#ec4899" />, emoji: '❤️' },
            { icon: <Flame size={16} color="#f97316" />, emoji: '🔥' },
            { icon: <Sparkles size={16} color="#eab308" />, emoji: '✨' },
            { icon: <Smile size={16} color="#06b6d4" />, emoji: '😂' },
            { icon: <Hand size={16} color="#a855f7" />, emoji: '👋' }
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
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'auto'
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
        background: 'rgba(9, 10, 21, 0.8)',
        position: 'relative',
        zIndex: 20
      }}>
        <input
          type="text"
          value={inputMsg}
          onChange={handleInputChange}
          onBlur={() => notifyTyping(false)}
          placeholder={`Type a message to ${peerName}...`}
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
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
