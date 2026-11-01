import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Send, SkipForward, UserPlus, UserCheck, LogOut, HelpCircle, Heart, Flame, Smile, Sparkles, Hand, Lock } from 'lucide-react';
import { extractPeerName } from '../services/socketService';

export function ChatBox() {
  const { user, isGuest, sendFriendRequest, friends, openUpgradeModal } = useAuth();
  const {
    currentPeer,
    messages,
    isPeerTyping,
    isPeerOnline,
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
  const typingTimerRef = useRef(null);

  const peerName = extractPeerName(currentPeer);
  const peerUsername = currentPeer ? (currentPeer.friendUserId || currentPeer.username || currentPeer.peerId || currentPeer.id) : '';
  const isAlreadyFriend = friends.some(f => (f.username === peerUsername || f.friendUserId === peerUsername || f.id === peerUsername));

  // Reset requestSent state whenever peer changes
  useEffect(() => {
    setRequestSent(false);
  }, [peerUsername]);

  const handleAddFriendClick = async () => {
    if (isGuest) {
      openUpgradeModal(`add ${peerName || 'this user'} to your friends`);
      return;
    }
    if (!peerUsername || sendingRequest || requestSent) return;
    setSendingRequest(true);
    try {
      await sendFriendRequest(peerUsername);
      setRequestSent(true);
    } catch (err) {
      if (err?.status === 409 || (err?.message && err.message.toLowerCase().includes('already exists'))) {
        setRequestSent(true);
      } else {
        console.warn("Failed to send friend request via API:", err);
      }
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
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        notifyTyping(false);
      }, 1500);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      notifyTyping(false);
    }
  };

  const handleIcebreakerClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    sendIcebreaker();
  };

  const handleReactionClick = (e, emoji) => {
    e.preventDefault();
    e.stopPropagation();
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
            backgroundColor: '#8b5cf6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            boxShadow: 'var(--shadow-glow)',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {currentPeer.photoUrl ? (
              <img
                src={currentPeer.photoUrl}
                alt={peerName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              '⚡'
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{peerName}</h3>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: isPeerOnline ? 'var(--green-accent)' : 'var(--text-muted)',
                background: isPeerOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                border: isPeerOnline ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 255, 255, 0.1)',
                padding: '2px 8px',
                borderRadius: '10px'
              }}>
                {isPeerOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="chat-peer-bio" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {currentPeer.bio || 'Random Chat Partner'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="chat-header-actions">
          {!isAlreadyFriend && (
            <button
              id="add-friend-btn"
              type="button"
              onClick={handleAddFriendClick}
              disabled={!isGuest && (requestSent || sendingRequest)}
              className="btn-cyan"
              style={{
                padding: '8px 14px',
                fontSize: '0.85rem',
                cursor: (!isGuest && (requestSent || sendingRequest)) ? 'default' : 'pointer',
                opacity: (!isGuest && requestSent) ? 0.85 : 1,
                background: (!isGuest && requestSent) ? 'rgba(52, 199, 89, 0.2)' : undefined,
                borderColor: (!isGuest && requestSent) ? '#34C759' : undefined
              }}
              title={isGuest ? "Sign up to add friends" : (requestSent ? "Friend Request Sent" : "Add to Friends")}
            >
              {isGuest ? (
                <>
                  <Lock size={15} />
                  <span>Add Friend</span>
                </>
              ) : requestSent ? (
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
            id="next-stranger-btn"
            type="button"
            onClick={skipStranger}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            <SkipForward size={16} />
            <span>Next Stranger</span>
          </button>

          <button
            id="disconnect-chat-btn"
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

          const myUsername = user?.username || user?.id;
          const isMe = msg.senderId === myUsername;

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
                {msg.time || msg.timestamp}
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
            gap: '6px'
          }}
        >
          <HelpCircle size={15} color="var(--cyan-accent)" />
          <span style={{ fontWeight: 600 }}>Ask Icebreaker</span>
        </button>

        {/* Quick Emojis */}
        <div className="chat-subbar-reactions" style={{ display: 'flex', gap: '6px' }}>
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
