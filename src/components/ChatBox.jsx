import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { SkipForward, UserPlus, UserCheck, LogOut, RefreshCw, X, Zap, UserRound, AlertTriangle, CheckCheck, Check, Clock, WifiOff, Palette } from 'lucide-react';
import { extractPeerName } from '../services/socketService';
import { authService } from '../services/authService';
import { PeerAbout } from './chat/PeerAbout';
import { ChatComposer } from './ChatComposer';
import { ChatMediaMessage } from './ChatMediaMessage';
import { useProfileCard } from './ProfileCard';
import { timeAgo } from './discover/discoverUtils';
import { useNewMessageIds, displayTime } from '../mobile/useNewMessageIds';
import { BottleGame, GameFeedCard } from './BottleGame';
import { playReveal, unlockGameAudio } from '../services/gameFx';
import { ChatQuickBar } from './chat/ChatQuickBar';
import { MessageShell, ReplyQuote, ReplyComposerBar } from './chat/MessageExtras';
import { isInteractive, jumpToMessage, bubbleClass } from './chat/messageUtils';
import { useMessageInteractions } from './chat/useMessageInteractions';
import { feedback } from '../mobile/feedback';
import { MarqueeText } from './MarqueeText';
import { TypingIndicator } from './chat/TypingIndicator';
import { useChatAutoScroll } from './chat/useChatAutoScroll';
import { useChatTheme } from './chat/chatThemes';
import { ChatThemePicker } from './chat/ChatThemePicker';

// AI partners we "sent" a friend request to (never sent to the server), kept across tab switches.
const botRequestsSent = new Set();

/** "last seen 3m ago", re-rendered every 30s so it keeps counting. */
function LastSeen({ value, prefix = 'last seen' }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);
  const ago = timeAgo(value);
  return ago ? `${prefix} ${ago}` : null;
}

export function ChatBox() {
  const {
    user,
    jwtToken,
    isGuest,
    openUpgradeModal,
    sendFriendRequest,
    acceptFriendRequest,
    cancelFriendRequest,
    friends,
    friendRequests,
    liveFriendRequest,
    soundEnabled
  } = useAuth();
  const { openProfile } = useProfileCard();
  const {
    currentPeer,
    messages,
    isPeerTyping,
    isPeerOnline,
    peerLastSeen,
    peerLeft,
    isLiveConnected,
    sendMessage,
    sendMedia,
    retryMessage,
    sendReaction,
    reactToMessage,
    deleteMessage,
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
  const [gameOpen, setGameOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const interactions = useMessageInteractions();
  const closeInteractions = interactions.close;
  const messagesEndRef = useRef(null);
  const feedRef = useRef(null);
  // The random room's theme is shared with the stranger and lasts for this match only.
  const [chatTheme, setChatTheme] = useChatTheme(currentPeer?.conversationId || currentPeer?.id || null);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const typingTimerRef = useRef(null);
  const inputRef = useRef(null);
  const lastGameRoundRef = useRef(null);

  const peerName = extractPeerName(currentPeer);
  // Peer IDENTITY is the stable user id. currentPeer.username/name are display only.
  const peerId = currentPeer ? (currentPeer.friendUserId || currentPeer.peerId || currentPeer.id || '') : '';
  // Server-side bot partners have ids like "bot-ananya-3f9c2a1b"; they are labelled as AI.
  const isAiPeer = typeof peerId === 'string' && peerId.startsWith('bot-');

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

    // AI partners are not real accounts: their friend status lives only on this screen.
    if (isAiPeer) {
      setFriendStatus(botRequestsSent.has(peerId) ? 'PENDING_SENT' : 'NONE');
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
  }, [peerId, isFriend, isIncomingRequest, jwtToken, isAiPeer]);

  const handleFriendActionClick = async () => {
    if (actionLoading || !peerId) return;

    // AI partner: show the request as sent (or cancelled) like a real one, but never call the
    // server, since a bot cannot receive or accept friend requests.
    if (isAiPeer) {
      if (botRequestsSent.has(peerId)) botRequestsSent.delete(peerId);
      else botRequestsSent.add(peerId);
      setFriendStatus(botRequestsSent.has(peerId) ? 'PENDING_SENT' : 'NONE');
      return;
    }

    if (friendStatus === 'ACCEPTED') {
      return;
    }

    // Friends need an account. The chat keeps going while the guest signs in, and the
    // request (or accept) is sent automatically afterwards.
    if (isGuest) {
      openUpgradeModal(
        friendStatus === 'PENDING_RECEIVED'
          ? `Sign in to accept ${peerName}'s friend request.`
          : `Sign in to add ${peerName} as a friend.`,
        { action: friendStatus === 'PENDING_RECEIVED' ? 'ACCEPT_FRIEND' : 'SEND_FRIEND', targetUserId: peerId }
      );
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

  // Tapping the peer opens the shared profile card. Blocking from it ends this room server-side
  // (the stranger just sees "left the chat"), so move straight on to the next stranger.
  const openPeerProfile = () => {
    if (!peerId) return;
    openProfile({
      id: peerId,
      name: peerName,
      username: currentPeer.username,
      photoUrl: currentPeer.photoUrl,
      bio: currentPeer.peerBio,
      isGuest: currentPeer.peerGuest
    }, {
      isAi: isAiPeer,
      topics: currentPeer.peerTopics,
      sharedTopics: currentPeer.sharedTopics,
      presence: { online: isPeerOnline && !peerLeft, lastSeen: peerLastSeen },
      inChat: true,
      onBlocked: () => skipStranger()
    });
  };

  // Nothing can reach a peer who left, or one who is temporarily disconnected: every action
  // that talks to them is switched off (Next / Exit stay available).
  const peerAway = !peerLeft && !isPeerOnline;
  const composerDisabled = peerLeft || !isLiveConnected || peerAway;
  const composerPlaceholder = peerLeft
    ? `${peerName} left the chat`
    : (!isLiveConnected ? 'Reconnecting…' : (peerAway ? `Waiting for ${peerName} to reconnect…` : 'Say something sweet…'));

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
  const lastMessage = messages.length ? messages[messages.length - 1] : null;
  useChatAutoScroll(feedRef, {
    threadKey: activeConvId || 'random',
    lastId: lastMessage?.id || null,
    count: messages.length,
    lastIsMine: Boolean(lastMessage && lastMessage.senderId === user?.id),
    pulse: `${isPeerTyping}|${gameOpen}|${game?.phase}|${game?.roundId}`
  });

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
    if (composerDisabled) return;
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

  const handleSend = () => {
    if (!inputMsg.trim() || composerDisabled) return;
    feedback('send');
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
    if (composerDisabled) return;
    sendIcebreaker();
  };

  const handleReactionClick = (e, emoji) => {
    e.preventDefault();
    e.stopPropagation();
    if (composerDisabled) return;
    sendReaction(emoji);
  };

  if (!currentPeer) return null;

  return (
    <div className="glass-panel chat-screen" data-chat-theme={chatTheme.id} style={{
      ...chatTheme.vars,
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

      {/* Top Header Bar: who you're talking to (tap for their profile), Friend + Exit */}
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
        <button
          type="button"
          className="chat-peer-info"
          onClick={openPeerProfile}
          aria-label={`View ${peerName}'s profile`}
          style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 auto', minWidth: 0 }}
        >
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
          <div style={{ flex: 1, minWidth: 0 }}>
            <MarqueeText as="h3" style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>{peerName}</MarqueeText>
            {peerLeft ? (
              <span className="chat-peer-status chat-peer-status--left">Left the chat</span>
            ) : isPeerOnline ? (
              <span className="online-badge" aria-label="Online">Online</span>
            ) : (
              <span className="chat-peer-status">
                Offline{peerLastSeen ? <> · <LastSeen value={peerLastSeen} /></> : null}
              </span>
            )}
          </div>
        </button>

        {/* Action Controls: friend request + exit only; block/report live on the profile card */}
        <div className="chat-header-actions">
          <button
            id="chat-theme-btn"
            type="button"
            onClick={() => setThemePickerOpen(true)}
            className="btn-secondary chat-tool-btn"
            title="Chat theme"
            aria-label="Change chat theme"
          >
            <Palette size={16} aria-hidden="true" />
          </button>
          {friendStatus === 'ACCEPTED' ? (
            <button
              id="friend-status-btn"
              type="button"
              disabled
              className="chat-friend-btn chat-friend-btn--friends"
              title="You are friends!"
            >
              <UserCheck size={16} aria-hidden="true" />
              <span className="label-long">Friends</span>
            </button>
          ) : friendStatus === 'PENDING_SENT' ? (
            <button
              id="cancel-friend-request-btn"
              type="button"
              onClick={handleFriendActionClick}
              disabled={actionLoading}
              className="chat-friend-btn chat-friend-btn--sent"
              title="Friend request sent. Tap to cancel"
              aria-label="Friend request sent. Tap to cancel"
            >
              <Clock size={16} aria-hidden="true" />
              <span className="label-long">{actionLoading ? 'Cancelling...' : 'Requested'}</span>
            </button>
          ) : friendStatus === 'PENDING_RECEIVED' ? (
            <button
              id="accept-friend-request-btn"
              type="button"
              onClick={handleFriendActionClick}
              disabled={actionLoading}
              className="btn-primary chat-friend-btn"
              title="Accept friend request"
              aria-label="Accept friend request"
            >
              <UserCheck size={16} aria-hidden="true" />
              <span className="label-long">{actionLoading ? 'Accepting...' : 'Accept'}</span>
            </button>
          ) : (
            <button
              id="add-friend-btn"
              type="button"
              onClick={handleFriendActionClick}
              disabled={actionLoading}
              className="btn-primary chat-friend-btn"
              title="Add to Friends"
              aria-label="Add Friend"
            >
              <UserPlus size={16} aria-hidden="true" />
              <span className="label-long">{actionLoading ? 'Sending...' : 'Add Friend'}</span>
            </button>
          )}

          <button
            id="disconnect-chat-btn"
            type="button"
            onClick={disconnectChat}
            className="btn-secondary chat-tool-btn"
            title="Leave chat"
            aria-label="Leave chat"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Feed */}
      <div className="chat-feed" ref={feedRef} style={{
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
          <div className="chat-intro">
            <svg className="chat-intro__heart" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20.5C9 18.2 4 14.6 4 9.8 4 7.2 6 5.2 8.4 5.2c1.5 0 2.8.8 3.6 2 .8-1.2 2.1-2 3.6-2C18 5.2 20 7.2 20 9.8c0 4.8-5 8.4-8 10.7Z" />
            </svg>
            <p className="chat-intro__title">It's just the two of you now.</p>
            <PeerAbout
              bio={currentPeer.peerBio}
              topics={currentPeer.peerTopics}
              sharedTopics={currentPeer.sharedTopics}
            />
            <p className="chat-intro__hint">Say hi, or tap Icebreaker if you're shy.</p>
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
                enabled={isInteractive(msg) && !composerDisabled}
                onReply={startReply}
                onReact={handleReact}
                onDelete={isMe && !peerLeft ? (m) => deleteMessage(m.id) : undefined}
              >
              <div className={bubbleClass(msg, isMe, isFailed)}>
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
                  <span className="chat-bubble__text">{msg.text || msg.message}</span>
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

        {/* Typing Indicator (folds open / closed so the feed never jumps) */}
        <TypingIndicator show={Boolean(isPeerTyping) && !peerLeft} name={peerName} />

        <div ref={messagesEndRef} />
      </div>

      {/* Icebreaker, Truth & Dare and quick emojis (same strip as friend DMs) */}
      <ChatQuickBar
        onIcebreaker={handleIcebreakerClick}
        onSpin={handleSpinClick}
        onEmoji={handleReactionClick}
        disabled={composerDisabled}
        spinId="spin-bottle-btn"
        themeEmoji={chatTheme.id !== 'default' ? chatTheme.quickEmoji : null}
      />

      {/* Peer left on purpose (Next / Exit / blocked) or never came back: this chat is over */}
      {peerLeft && (
        <div className="chat-state-banner chat-state-banner--left" role="status">
          <span>
            <strong>{peerName} left the chat.</strong> Nothing more can be sent here.
          </span>
          <button
            id="find-new-match-btn"
            type="button"
            onClick={startSearching}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: 'var(--fs-md)', cursor: 'pointer' }}
          >
            <Zap size={16} aria-hidden="true" />
            <span>Find a new match</span>
          </button>
        </div>
      )}

      {/* Peer's connection dropped (phone locked, app in background): they can still come back */}
      {peerAway && isLiveConnected && (
        <div className="chat-state-banner chat-state-banner--away" role="status">
          <WifiOff size={16} aria-hidden="true" />
          <span>Disconnected for now. Wait, or find a new match.</span>
          <button
            type="button"
            onClick={skipStranger}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: 'var(--fs-md)', cursor: 'pointer', flexShrink: 0 }}
          >
            <SkipForward size={16} aria-hidden="true" />
            <span>New match</span>
          </button>
        </div>
      )}

      {/* Our own connection is down — say so instead of silently swallowing messages */}
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
          Reconnecting… you'll be put back into this chat as soon as you're online.
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

      {/* Message bar: Next match on the left, then the message field (image inside), then mic / send */}
      <ChatComposer
        value={inputMsg}
        onChange={handleInputChange}
        onSubmit={handleSend}
        onBlur={() => notifyTyping(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && replyTarget) {
            e.preventDefault();
            setReplyTarget(null);
          }
        }}
        inputRef={inputRef}
        disabled={composerDisabled}
        placeholder={composerPlaceholder}
        conversationId={currentPeer?.conversationId || currentPeer?.id}
        onSendMedia={handleSendMedia}
        onMediaError={setMediaError}
        leading={(
          <button
            id="next-stranger-btn"
            type="button"
            onClick={skipStranger}
            className="wa-next-btn"
            title="Next match"
            aria-label="Next match"
          >
            <SkipForward size={15} strokeWidth={1.75} aria-hidden="true" />
            <span className="wa-next-btn__label">Next</span>
          </button>
        )}
      />

      <ChatThemePicker
        open={themePickerOpen}
        currentId={chatTheme.id}
        onSelect={setChatTheme}
        onClose={() => setThemePickerOpen(false)}
        peerName={peerName}
      />

      {/* Truth & Dare: a dialog over this chat screen only; the chat behind it is blurred. */}
      {gameOpen && (
        <div className="bg-backdrop">
          <BottleGame
            game={game}
            myId={user?.id}
            me={{ name: user?.name || user?.username || 'You', photoUrl: user?.photoUrl }}
            peer={{ name: peerName, photoUrl: currentPeer.photoUrl }}
            disabled={composerDisabled}
            spinPending={spinPending}
            soundEnabled={soundEnabled}
            onSpin={spinBottle}
            onChoose={chooseGameOption}
            onAsk={askGameQuestion}
            onClose={handleGameClose}
          />
        </div>
      )}

    </div>
  );
}
