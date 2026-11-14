import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Send, SkipForward, UserPlus, UserCheck, LogOut, HelpCircle, Heart, Flame, Smile, Star, Hand, Lock, RefreshCw, X, Zap, Ban, UserRound, AlertTriangle, CheckCheck, Check, Wine } from 'lucide-react';
import { extractPeerName, MAX_MESSAGE_LENGTH } from '../services/socketService';
import { authService } from '../services/authService';
import { MediaComposer } from './MediaComposer';
import { ChatMediaMessage } from './ChatMediaMessage';
import { DiscoverConfirmDialog } from './discover/DiscoverConfirmDialog';
import { useNewMessageIds, displayTime } from '../mobile/useNewMessageIds';
import { BottleGame, GameFeedCard } from './BottleGame';
import { playReveal, unlockGameAudio } from '../services/gameFx';
import { MessageShell, ReplyQuote, ReplyComposerBar } from './chat/MessageExtras';
import { isInteractive, jumpToMessage } from './chat/messageUtils';
import { useMessageInteractions } from './chat/useMessageInteractions';

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
    openUpgradeModal,
    blockUser,
    soundEnabled
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
    reactToMessage,
    sendIcebreaker,
    skipStranger,
    startSearching,
    disconnectChat,
    floatingReactions,
    notifyTyping,
    bottleGame,
    spinBottle,
    chooseGameOption,
    askGameQuestion,
    closeGame
  } = useSocket();

  const [inputMsg, setInputMsg] = useState('');
  const [friendStatus, setFriendStatus] = useState('NONE'); // 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'ACCEPTED'
  const [actionLoading, setActionLoading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blockError, setBlockError] = useState('');
  const [gameOpen, setGameOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const interactions = useMessageInteractions();
  const closeInteractions = interactions.close;
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const inputRef = useRef(null);
  const lastGameRoundRef = useRef(null);

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

  const openBlockConfirm = () => {
    setBlockError('');
    setBlockConfirmOpen(true);
  };

  // Block ends this room server-side (the stranger just sees "left the chat"), and the
  // matchmaker never pairs the two again. Then move straight on to the next stranger.
  const handleConfirmBlock = async () => {
    if (!peerId || blocking) return;
    setBlocking(true);
    setBlockError('');
    try {
      await blockUser(peerId);
      setBlockConfirmOpen(false);
      skipStranger();
    } catch (err) {
      setBlockError(err?.message || 'Could not block this user. Please try again.');
    } finally {
      setBlocking(false);
    }
  };

  const composerDisabled = peerLeft || !isLiveConnected;
  const composerPlaceholder = peerLeft
    ? 'Your chat partner left the chat'
    : (!isLiveConnected ? 'Reconnecting…' : 'Say something sweet…');

  const freshIds = useNewMessageIds(messages, currentPeer?.id || 'random');

  // Spin the Bottle belongs to this room only; a round from a previous stranger is ignored.
  const activeConvId = currentPeer?.conversationId || currentPeer?.id || null;
  const roomGame = bottleGame && bottleGame.conversationId === activeConvId ? bottleGame : null;
  // CLOSED only tells us to close the dialog; the table itself starts fresh next time.
  const game = roomGame && roomGame.phase !== 'CLOSED' ? roomGame : null;

  // Either player closing the dialog closes it on both phones.
  const lastCloseRef = useRef(null);
  useEffect(() => {
    if (roomGame?.phase === 'CLOSED' && roomGame.receivedAt !== lastCloseRef.current) {
      lastCloseRef.current = roomGame.receivedAt;
      setGameOpen(false);
    }
  }, [roomGame?.phase, roomGame?.receivedAt]);

  const handleGameClose = () => {
    setGameOpen(false);
    closeGame();
  };

  // Follow NEW messages only: a reaction on an old message must not yank the feed to the bottom.
  const lastMessageId = messages.length ? messages[messages.length - 1].id : null;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastMessageId, messages.length, isPeerTyping, gameOpen, game?.phase, game?.roundId]);

  const messagesById = useMemo(() => {
    const map = new Map();
    messages.forEach(m => { if (m.id) map.set(m.id, m); });
    return map;
  }, [messages]);

  const authorLabel = (m) => (m && m.senderId === user?.id ? 'You' : peerName);

  const startReply = (m) => {
    setReplyTarget(m);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleReact = (m, emoji) => {
    reactToMessage(m.id, emoji);
  };

  const handleSendMedia = (media) => {
    const ok = sendMedia({ ...media, referredMessageId: replyTarget?.id || null });
    setReplyTarget(null);
    return ok;
  };

  // Whoever spins, both players are pulled onto the table to watch the bottle.
  useEffect(() => {
    if (game?.phase === 'SPIN' && game.roundId !== lastGameRoundRef.current) {
      lastGameRoundRef.current = game.roundId;
      setGameOpen(true);
    }
  }, [game?.phase, game?.roundId]);

  // Once Truth / Dare / WYR is picked, the question lands in the feed as a card: fold the
  // inline table away and put whoever answers straight into the composer.
  const lastQuestionRoundRef = useRef(null);
  useEffect(() => {
    if (game?.phase === 'QUESTION' && game.roundId !== lastQuestionRoundRef.current) {
      lastQuestionRoundRef.current = game.roundId;
      setGameOpen(false);
      playReveal({ sound: soundEnabled });
      if (game.targetId === user?.id) setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [game?.phase, game?.roundId, game?.targetId, user?.id]);

  // Tapping Spin spins right away: the dialog opens here now, and on the peer's phone as
  // soon as the server's SPIN event reaches both of us.
  const [spinPending, setSpinPending] = useState(false);
  const handleSpinClick = () => {
    if (peerLeft || !isLiveConnected) return;
    unlockGameAudio();
    const sent = spinBottle();
    setSpinPending(Boolean(sent));
    setGameOpen(true);
  };
  useEffect(() => {
    if (!gameOpen) setSpinPending(false);
  }, [gameOpen]);

  // A new stranger (or the peer leaving) closes the table and drops a pending reply.
  useEffect(() => {
    setGameOpen(false);
    setReplyTarget(null);
    closeInteractions();
  }, [activeConvId, peerLeft, closeInteractions]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputMsg.trim() || composerDisabled) return;
    sendMessage(inputMsg, replyTarget?.id || null);
    setInputMsg('');
    setReplyTarget(null);
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
    <div className="glass-panel chat-screen" style={{
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
      <div className="chat-topbar" style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(26, 16, 25, 0.4)',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Peer Profile Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            backgroundColor: 'var(--plum-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--fs-2xl)',
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
              <UserRound size={18} aria-hidden="true" />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: '8px', rowGap: '2px' }}>
              <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>{peerName}</h3>
              {isPeerOnline ? (
                <span className="online-badge" aria-label="Online">Online</span>
              ) : (
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Offline</span>
              )}
            </div>
            <p className="chat-peer-bio" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
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
                fontSize: 'var(--fs-md)',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(63, 178, 127, 0.4)',
                background: 'rgba(63, 178, 127, 0.15)',
                color: '#3fb27f',
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
                fontSize: 'var(--fs-md)',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-strong)',
                background: 'transparent',
                color: 'var(--text-secondary)',
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
                fontSize: 'var(--fs-md)',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--accent-ink)',
                cursor: 'pointer'
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
              className={isGuest ? 'btn-secondary' : 'btn-primary'}
              style={{
                color: isGuest ? 'var(--text-secondary)' : undefined,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: 'var(--fs-md)',
                cursor: 'pointer'
              }}
              title={isGuest ? "Sign up to add friends" : "Add to Friends"}
              aria-label={isGuest ? "Add Friend (sign up to unlock)" : "Add Friend"}
            >
              <UserPlus size={16} aria-hidden="true" />
              <span className="label-long">{actionLoading ? 'Sending...' : 'Add Friend'}</span>
              <span className="label-short">Add</span>
              {isGuest && <Lock size={12} aria-hidden="true" />}
            </button>
          )}

          <button
            id="next-stranger-btn"
            type="button"
            onClick={skipStranger}
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: 'var(--fs-md)', cursor: 'pointer' }}
          >
            <SkipForward size={16} aria-hidden="true" />
            <span className="label-long">Next Stranger</span>
            <span className="label-short">Next</span>
          </button>

          <button
            id="block-stranger-btn"
            type="button"
            onClick={openBlockConfirm}
            disabled={!peerId || blocking}
            className="btn-secondary chat-tool-btn"
            style={{ padding: '8px 12px', cursor: 'pointer' }}
            title={`Block ${peerName}`}
            aria-label={`Block ${peerName}`}
          >
            <Ban size={16} />
          </button>

          <button
            id="disconnect-chat-btn"
            type="button"
            onClick={disconnectChat}
            className="btn-secondary chat-tool-btn"
            style={{ padding: '8px 12px', cursor: 'pointer' }}
            title="Leave Chat"
            aria-label="Leave Chat"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Messages Scroll Feed */}
      <div className="chat-feed" style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        zIndex: 10
      }}>
        {!messages.some(m => m.senderId !== 'system') && !peerLeft && (
          <div className="chat-intro" aria-hidden="true">
            <svg className="chat-intro__heart" viewBox="0 0 24 24">
              <path d="M12 20.5C9 18.2 4 14.6 4 9.8 4 7.2 6 5.2 8.4 5.2c1.5 0 2.8.8 3.6 2 .8-1.2 2.1-2 3.6-2C18 5.2 20 7.2 20 9.8c0 4.8-5 8.4-8 10.7Z" />
            </svg>
            <p className="chat-intro__title">It's just the two of you now.</p>
            <p className="chat-intro__hint">Say hi, or tap Ask Icebreaker if you're shy.</p>
          </div>
        )}
        {messages.map(msg => {
          if (msg.senderId === 'game') {
            return (
              <GameFeedCard key={msg.id} msg={msg} myId={user?.id} peerName={peerName} />
            );
          }

          if (msg.senderId === 'system') {
            return (
              <div key={msg.id} style={{
                textAlign: 'center',
                margin: '12px 0',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sub)',
                fontSize: 'var(--fs-md)'
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
              className={freshIds.has(msg.id) ? `bubble-in ${isMe ? 'bubble-in--me' : 'bubble-in--them'}` : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start'
              }}
            >
              <MessageShell
                msg={msg}
                isMe={isMe}
                myId={myId}
                interactions={interactions}
                enabled={isInteractive(msg) && !peerLeft && isLiveConnected}
                onReply={startReply}
                onReact={handleReact}
              >
              <div style={{
                maxWidth: '100%',
                padding: '12px 18px',
                borderRadius: isMe ? 'var(--radius-bubble) var(--radius-bubble) var(--radius-xs) var(--radius-bubble)' : 'var(--radius-bubble) var(--radius-bubble) var(--radius-bubble) var(--radius-xs)',
                background: isFailed
                  ? 'rgba(229, 72, 77, 0.18)'
                  : isMe
                    ? 'var(--accent-tint)'
                    : 'var(--plum-3)',
                border: isFailed
                  ? '1px dashed #e5484d'
                  : isMe ? '1px solid var(--accent-line)' : '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: 'var(--fs-body)',
                lineHeight: '1.4',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word'
              }}>
                {msg.referredMessageId && (
                  <ReplyQuote
                    quoted={messagesById.get(msg.referredMessageId)}
                    authorLabel={authorLabel(messagesById.get(msg.referredMessageId))}
                    onJump={() => jumpToMessage(msg.referredMessageId)}
                  />
                )}
                {msg.type === 'IMAGE' || msg.type === 'AUDIO' ? (
                  <ChatMediaMessage msg={msg} />
                ) : (
                  msg.text || msg.message
                )}
              </div>
              </MessageShell>

              {isFailed ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '6px',
                  fontSize: '0.78rem',
                  color: 'var(--danger)'
                }}>
                  <AlertTriangle size={14} aria-hidden="true" /><span>Not delivered.</span>
                  {msg.serverRefused ? null : (
                  <button
                    id="retry-message-btn"
                    type="button"
                    disabled={peerLeft || !isPeerOnline || !isLiveConnected}
                    onClick={() => retryMessage(msg.id)}
                    style={{
                      background: 'var(--danger-line)',
                      border: '1px solid var(--danger-line)',
                      color: 'var(--text-primary)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '2px 8px',
                      fontSize: 'var(--fs-xs)',
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
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-muted)',
                  marginTop: '4px',
                  padding: '0 4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>{displayTime(msg.time || msg.timestamp)}</span>
                  {isMe && (
                    <>
                      <span>•</span>
                      {msg.status === 'SEEN' ? (
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><CheckCheck size={13} aria-hidden="true" />Seen</span>
                      ) : msg.status === 'SENDING' ? (
                        <span>Sending...</span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Check size={13} aria-hidden="true" />Sent</span>
                      )}
                    </>
                  )}
                </span>
              )}
            </div>
          );
        })}

        {/* Typing Indicator */}
        {isPeerTyping && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: 'var(--fs-md)' }}>
            <span>{peerName} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Bar: Icebreaker & Quick Reactions */}
      <div className="chat-subbar" style={{
        padding: '10px 20px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(26, 16, 25, 0.5)',
        position: 'relative',
        zIndex: 20
      }}>
        <div className="chat-subbar-actions">
          {/* Icebreaker button */}
          <button
            type="button"
            onClick={handleIcebreakerClick}
            className="btn-secondary chat-subbar-pill"
          >
            <HelpCircle size={15} color="var(--text-secondary)" aria-hidden="true" />
            <span className="label-long">Ask Icebreaker</span>
            <span className="label-short">Icebreaker</span>
          </button>

          {/* Spin the Bottle */}
          <button
            id="spin-bottle-btn"
            type="button"
            onClick={handleSpinClick}
            disabled={peerLeft || !isLiveConnected}
            className="btn-secondary chat-subbar-pill chat-game-btn"
            aria-label="Play Truth & Dare"
          >
            <Wine size={15} aria-hidden="true" />
            <span className="label-long">Truth &amp; Dare</span>
            <span className="label-short">T &amp; D</span>
          </button>
        </div>

        {/* Quick Emojis */}
        <div className="chat-subbar-reactions" style={{ display: 'flex', gap: '6px' }}>
          {[
            { icon: <Heart size={16} />, emoji: '❤️' },
            { icon: <Flame size={16} />, emoji: '🔥' },
            { icon: <Star size={16} />, emoji: '✨' },
            { icon: <Smile size={16} />, emoji: '😂' },
            { icon: <Hand size={16} />, emoji: '👋' }
          ].map(item => (
            <button
              key={item.emoji}
              type="button"
              onClick={(e) => handleReactionClick(e, item.emoji)}
              className="reaction-chip"
              aria-label={`Send ${item.emoji}`}
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
          background: 'var(--danger-tint)',
          borderTop: '1px solid var(--danger-line)',
          position: 'relative',
          zIndex: 20
        }}>
          <span style={{ fontSize: 'var(--fs-md)', color: 'var(--danger)' }}>
            Your chat partner left the chat.
          </span>
          <button
            id="find-new-match-btn"
            type="button"
            onClick={startSearching}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: 'var(--fs-md)', cursor: 'pointer' }}
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
          background: 'rgba(240, 114, 137, 0.12)',
          borderTop: '1px solid rgba(240, 114, 137, 0.35)',
          color: '#f6a3b2',
          fontSize: 'var(--fs-md)',
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
          background: 'var(--danger-tint)',
          borderTop: '1px solid var(--danger-line)',
          color: 'var(--danger)',
          fontSize: 'var(--fs-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          position: 'relative',
          zIndex: 20
        }}>
          <AlertTriangle size={14} aria-hidden="true" /><span>{mediaError}</span>
          <button
            type="button"
            onClick={() => setMediaError('')}
            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 700 }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {!composerDisabled && (
        <ReplyComposerBar
          target={replyTarget}
          authorLabel={authorLabel(replyTarget)}
          onCancel={() => setReplyTarget(null)}
        />
      )}

      {/* Text Message Input */}
      <form className="chat-composer" onSubmit={handleSend} style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(20, 12, 20, 0.8)',
        position: 'relative',
        zIndex: 20
      }}>
        <MediaComposer
          conversationId={currentPeer?.conversationId || currentPeer?.id}
          disabled={composerDisabled}
          onSend={handleSendMedia}
          onError={setMediaError}
        />
        <input
          ref={inputRef}
          type="text"
          value={inputMsg}
          onChange={handleInputChange}
          onBlur={() => notifyTyping(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && replyTarget) {
              e.preventDefault();
              setReplyTarget(null);
            }
          }}
          disabled={composerDisabled}
          placeholder={composerPlaceholder}
          maxLength={MAX_MESSAGE_LENGTH}
          style={{
            flex: 1,
            padding: '14px 20px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            fontSize: 'var(--fs-body)',
            outline: 'none',
            opacity: composerDisabled ? 0.6 : 1
          }}
        />
        <button
          type="submit"
          className="btn-primary send-btn"
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

      {/* Truth & Dare: a dialog over this chat screen only; the chat behind it is blurred. */}
      {gameOpen && (
        <div className="bg-backdrop">
          <BottleGame
            game={game}
            myId={user?.id}
            me={{ name: user?.name || user?.username || 'You', photoUrl: user?.photoUrl }}
            peer={{ name: peerName, photoUrl: currentPeer.photoUrl }}
            disabled={peerLeft || !isLiveConnected}
            spinPending={spinPending}
            soundEnabled={soundEnabled}
            onSpin={spinBottle}
            onChoose={chooseGameOption}
            onAsk={askGameQuestion}
            onClose={handleGameClose}
          />
        </div>
      )}

      <DiscoverConfirmDialog
        open={blockConfirmOpen}
        title={`Block ${peerName}?`}
        body="This ends the chat now. You will never be matched with them again, they cannot find you or send you friend requests, and any friendship and chat history with them is removed. You can unblock them later from the Friends tab."
        confirmLabel={blocking ? 'Blocking…' : 'Block & skip'}
        danger
        busy={blocking}
        error={blockError}
        onConfirm={handleConfirmBlock}
        onCancel={() => setBlockConfirmOpen(false)}
      />
    </div>
  );
}
