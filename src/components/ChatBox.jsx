import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Send, SkipForward, UserPlus, UserCheck, LogOut, HelpCircle, Heart, Flame, Smile, Sparkles, Hand, Lock, RefreshCw, X, Zap } from 'lucide-react';
import { extractPeerName, MAX_MESSAGE_LENGTH } from '../services/socketService';
import { authService } from '../services/authService';
import { MediaComposer } from './MediaComposer';
import { ChatMediaMessage } from './ChatMediaMessage';

export function ChatBox() {
  const {
    user,
    jwtToken,
    isGuest,
    sendFriendRequest,
    acceptFriendRequest,
    cancelFriendRequest,
    friends,
    friendRequests,
    liveFriendRequest,
    openUpgradeModal
  } = useAuth();
  const {
    currentPeer,
    messages,
    isPeerTyping,
    isPeerOnline,
    peerLeft,
    isLiveConnected,
    sendMessage,
    sendMedia,
    retryMessage,
    sendReaction,
    sendIcebreaker,
    skipStranger,
    startSearching,
    disconnectChat,
    floatingReactions,
    notifyTyping
  } = useSocket();

  const [inputMsg, setInputMsg] = useState('');
  const [friendStatus, setFriendStatus] = useState('NONE'); // 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'ACCEPTED'
  const [actionLoading, setActionLoading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  const peerName = extractPeerName(currentPeer);
  // Peer IDENTITY is the stable user id. currentPeer.username/name are display only.
  const peerId = currentPeer ? (currentPeer.friendUserId || currentPeer.peerId || currentPeer.id || '') : '';

  // Derive membership from stable booleans, so a refreshed list identity does not
  // re-query the friendship status endpoint.
  const isFriend = useMemo(
    () => friends.some(f => (f.id === peerId || f.friendUserId === peerId)),
    [friends, peerId]
  );
  const isIncomingRequest = useMemo(
    () => Boolean(
      (liveFriendRequest && (liveFriendRequest.id === peerId || liveFriendRequest.friendUserId === peerId)) ||
      friendRequests.some(r => (r.id === peerId || r.friendUserId === peerId))
    ),
    [friendRequests, liveFriendRequest, peerId]
  );

  // Synchronize status with friends list, incoming friendRequests, and backend status API
  useEffect(() => {
    if (!peerId) {
      setFriendStatus('NONE');
      return;
    }
    if (isFriend) {
      setFriendStatus('ACCEPTED');
      return;
    }
    if (isIncomingRequest) {
      setFriendStatus('PENDING_RECEIVED');
      return;
    }

    // Query backend friendship status once per peer
    let isCancelled = false;
    const token = jwtToken || authService.getToken();
    if (token) {
      authService.getFriendshipStatus(peerId, token)
        .then(res => {
          if (!isCancelled && res?.status) {
            setFriendStatus(res.status);
          }
        })
        .catch(() => {});
    }

    return () => {
      isCancelled = true;
    };
  }, [peerId, isFriend, isIncomingRequest, jwtToken]);

  const handleFriendActionClick = async () => {
    if (actionLoading || !peerId) return;

    if (friendStatus === 'ACCEPTED') {
      return;
    }

    if (friendStatus === 'PENDING_SENT') {
      setActionLoading(true);
      try {
        await cancelFriendRequest(peerId);
        setFriendStatus('NONE');
      } catch (err) {
        console.warn('Failed to cancel friend request:', err);
      } finally {
        setActionLoading(false);
      }
      return;
    }

    if (friendStatus === 'PENDING_RECEIVED') {
      if (isGuest) {
        openUpgradeModal(`create an account to accept friend request from ${peerName}`, {
          action: 'ACCEPT_FRIEND',
          targetUserId: peerId
        });
        return;
      }
      setActionLoading(true);
      try {
        await acceptFriendRequest(peerId);
        setFriendStatus('ACCEPTED');
      } catch (err) {
        console.warn('Failed to accept friend request:', err);
      } finally {
        setActionLoading(false);
      }
      return;
    }

    // Case: 'NONE' -> Send friend request
    if (isGuest) {
      openUpgradeModal(`create an account to add ${peerName} as a friend`, {
        action: 'SEND_FRIEND',
        targetUserId: peerId
      });
      return;
    }

    setActionLoading(true);
    try {
      await sendFriendRequest(peerId);
      setFriendStatus('PENDING_SENT');
    } catch (err) {
      if (err?.status === 409 || (err?.message && err.message.toLowerCase().includes('already exists'))) {
        setFriendStatus('PENDING_SENT');
      } else {
        console.warn('Failed to send friend request:', err);
      }
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

  const composerDisabled = peerLeft || !isLiveConnected;
  const composerPlaceholder = peerLeft
    ? 'Your chat partner left the chat'
    : (!isLiveConnected ? 'Reconnecting…' : `Type a message to ${peerName}...`);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputMsg.trim() || composerDisabled) return;
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
          {friendStatus === 'ACCEPTED' ? (
            <button
              id="friend-status-btn"
              type="button"
              disabled
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: '12px',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                cursor: 'default'
              }}
              title="You are friends!"
            >
              <UserCheck size={16} />
              <span>Friends</span>
            </button>
          ) : friendStatus === 'PENDING_SENT' ? (
            <button
              id="cancel-friend-request-btn"
              type="button"
              onClick={handleFriendActionClick}
              disabled={actionLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: '12px',
                border: '1px solid #f59e0b',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                cursor: 'pointer'
              }}
              title="Click to cancel friend request"
            >
              <X size={15} />
              <span>{actionLoading ? 'Cancelling...' : 'Pending (Cancel)'}</span>
            </button>
          ) : friendStatus === 'PENDING_RECEIVED' ? (
            <button
              id="accept-friend-request-btn"
              type="button"
              onClick={handleFriendActionClick}
              disabled={actionLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: '12px',
                border: 'none',
                background: '#10b981',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
              title="Click to accept friend request"
            >
              <UserCheck size={16} />
              <span>{actionLoading ? 'Accepting...' : 'Accept Friend'}</span>
            </button>
          ) : (
            <button
              id="add-friend-btn"
              type="button"
              onClick={handleFriendActionClick}
              disabled={actionLoading}
              className="btn-cyan"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
              title={isGuest ? "Sign up to add friends" : "Add to Friends"}
            >
              {isGuest ? (
                <>
                  <Lock size={15} />
                  <span>Add Friend</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>{actionLoading ? 'Sending...' : 'Add Friend'}</span>
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

          const myId = user?.id;
          const isMe = msg.senderId === myId;
          const isFailed = msg.status === 'FAILED';

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
                background: isFailed
                  ? 'rgba(239, 68, 68, 0.18)'
                  : isMe 
                    ? 'linear-gradient(135deg, var(--primary-purple) 0%, #6366f1 100%)' 
                    : 'rgba(255, 255, 255, 0.08)',
                border: isFailed
                  ? '1px dashed #ef4444'
                  : isMe ? 'none' : '1px solid var(--border-color)',
                color: '#ffffff',
                fontSize: '0.95rem',
                lineHeight: '1.4',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                boxShadow: isMe && !isFailed ? 'var(--shadow-glow)' : 'none'
              }}>
                {msg.type === 'IMAGE' || msg.type === 'AUDIO' ? (
                  <ChatMediaMessage msg={msg} />
                ) : (
                  msg.text || msg.message
                )}
              </div>

              {isFailed ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '6px',
                  fontSize: '0.78rem',
                  color: '#f87171'
                }}>
                  <span>⚠️ Not delivered.</span>
                  {msg.serverRefused ? null : (
                  <button
                    id="retry-message-btn"
                    type="button"
                    disabled={peerLeft || !isPeerOnline || !isLiveConnected}
                    onClick={() => retryMessage(msg.id)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.25)',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
                      color: '#ffffff',
                      borderRadius: '8px',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>Retry</span>
                  </button>
                  )}
                </div>
              ) : (
                <span style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  marginTop: '4px',
                  padding: '0 4px'
                }}>
                  {msg.time || msg.timestamp}
                </span>
              )}
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

      {/* Peer left the chat — a retry can never work, so offer a new match instead */}
      {peerLeft && (
        <div style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          background: 'rgba(239, 68, 68, 0.12)',
          borderTop: '1px solid rgba(239, 68, 68, 0.35)',
          position: 'relative',
          zIndex: 20
        }}>
          <span style={{ fontSize: '0.88rem', color: '#fca5a5' }}>
            Your chat partner left the chat.
          </span>
          <button
            id="find-new-match-btn"
            type="button"
            onClick={startSearching}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            <Zap size={16} />
            <span>Find a new match</span>
          </button>
        </div>
      )}

      {/* Connection is down — say so instead of silently swallowing messages */}
      {!isLiveConnected && !peerLeft && (
        <div style={{
          padding: '10px 20px',
          background: 'rgba(234, 179, 8, 0.12)',
          borderTop: '1px solid rgba(234, 179, 8, 0.35)',
          color: '#fde68a',
          fontSize: '0.85rem',
          position: 'relative',
          zIndex: 20
        }}>
          Reconnecting… messages cannot be delivered right now.
        </div>
      )}

      {/* Media error is always visible, never silent (CONTRACT B2-3) */}
      {mediaError && (
        <div id="chat-media-error" style={{
          padding: '8px 20px',
          background: 'rgba(239, 68, 68, 0.12)',
          borderTop: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          position: 'relative',
          zIndex: 20
        }}>
          <span>⚠️ {mediaError}</span>
          <button
            type="button"
            onClick={() => setMediaError('')}
            style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

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
        <MediaComposer
          conversationId={currentPeer?.conversationId || currentPeer?.id}
          disabled={composerDisabled}
          onSend={sendMedia}
          onError={setMediaError}
        />
        <input
          type="text"
          value={inputMsg}
          onChange={handleInputChange}
          onBlur={() => notifyTyping(false)}
          disabled={composerDisabled}
          placeholder={composerPlaceholder}
          maxLength={MAX_MESSAGE_LENGTH}
          style={{
            flex: 1,
            padding: '14px 20px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            color: 'white',
            fontSize: '0.95rem',
            outline: 'none',
            opacity: composerDisabled ? 0.6 : 1
          }}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={composerDisabled}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: composerDisabled ? 'not-allowed' : 'pointer'
          }}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
