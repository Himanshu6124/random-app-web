import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { X, UserPlus, UserCheck, Clock, MessageCircle, UserMinus, Ban, Flag, MapPin, UserRound, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { navigateTo } from '../services/notify';
import { Portal } from './Portal';
import { PeerAbout } from './chat/PeerAbout';
import { timeAgo } from './discover/discoverUtils';
import { feedback } from '../mobile/feedback';
import { isBotUserId, useResolvedFriendStatus } from '../services/botPeers';

const ProfileCardContext = createContext({ openProfile: () => {}, closeProfile: () => {} });

/**
 * One profile card for the whole app. Any screen calls openProfile(person, options) when a
 * profile picture or name is tapped:
 *
 *   person:  { id, name, username, photoUrl, bio, gender, isOnline, lastOnline, isGuest }
 *            (only id is required; the rest renders instantly and is refreshed from the server)
 *   options: { topics, sharedTopics, presence: { online, lastSeen }, inChat,
 *              onBlocked, onRemoved }
 */
export function ProfileCardProvider({ children }) {
  const [open, setOpen] = useState(null);
  const openProfile = useCallback((person, options = {}) => {
    if (!person || !(person.id || person.friendUserId)) return;
    setOpen({ person, options, key: Date.now() });
  }, []);
  const closeProfile = useCallback(() => setOpen(null), []);
  const value = useMemo(() => ({ openProfile, closeProfile }), [openProfile, closeProfile]);

  return (
    <ProfileCardContext.Provider value={value}>
      {children}
      {open && (
        <ProfileCard key={open.key} person={open.person} options={open.options} onClose={closeProfile} />
      )}
    </ProfileCardContext.Provider>
  );
}

export const useProfileCard = () => useContext(ProfileCardContext);

const REPORT_REASONS = ['Spam or scam', 'Harassment or hate', 'Sexual content', 'Seems underage', 'Something else'];

function presenceLabel(online, lastSeen) {
  if (online) return 'Online';
  const ago = timeAgo(lastSeen);
  return ago ? `Last seen ${ago}` : 'Offline';
}

function ProfileCard({ person: initial, options, onClose }) {
  const {
    user, jwtToken, isGuest, openUpgradeModal, friends,
    sendFriendRequest, cancelFriendRequest, acceptFriendRequest, removeFriend, blockUser, reportUser
  } = useAuth();
  const id = initial.id || initial.friendUserId;
  const isSelf = id === user?.id;

  const [person, setPerson] = useState(initial);
  const [status, setStatus] = useState(null); // NONE | PENDING_SENT | PENDING_RECEIVED | ACCEPTED | BLOCKED
  const [distanceKm, setDistanceKm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Inline confirmation instead of a second dialog: 'remove' | 'block' | 'report'
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');

  const isFriend = friends.some(f => (f.id || f.friendUserId) === id);
  const resolvedStatus = useResolvedFriendStatus(user?.id, id, status || 'NONE');
  const effectiveStatus = isFriend ? 'ACCEPTED' : resolvedStatus;

  // Close on Escape, like every other sheet.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Fresh profile, friendship and distance from the server, the same for every person.
  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    const token = jwtToken || authService.getToken();
    if (!token) return undefined;

    authService.getUserById(id, token)
      .then(u => { if (!cancelled && u) setPerson(prev => ({ ...prev, ...u, name: u.name || prev.name, photoUrl: u.photoUrl || prev.photoUrl })); })
      .catch(() => {});
    // A bot's friendship status lives on this device (services/botPeers), not on the server.
    if (!isSelf && !isBotUserId(id)) {
      authService.getFriendshipStatus(id, token)
        .then(res => { if (!cancelled && res?.status) setStatus(res.status); })
        .catch(() => {});
    }
    if (!isSelf) {
      authService.getDistanceTo(id, token)
        .then(res => { if (!cancelled && typeof res?.distanceKm === 'number') setDistanceKm(res.distanceKm); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [id, isSelf, jwtToken]);

  const name = person.name || person.friendUserName || person.username || 'Someone';
  const online = options.presence ? Boolean(options.presence.online) : Boolean(person.isOnline ?? person.online);
  const lastSeen = options.presence ? options.presence.lastSeen : person.lastOnline;
  const gender = (person.gender || '').toLowerCase();
  const genderLabel = gender === 'girl' ? 'Female' : gender === 'boy' ? 'Male' : null;
  const guestPeer = Boolean(person.isGuest || person.guest || person.peerGuest);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      feedback('error');
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const needsAccount = (msg, action) => {
    if (!isGuest) return false;
    openUpgradeModal(msg, { action, targetUserId: id });
    onClose();
    return true;
  };

  const addFriend = () => {
    if (needsAccount(`Sign in to add ${name} as a friend.`, 'SEND_FRIEND')) return;
    run(async () => {
      try {
        await sendFriendRequest(id);
      } catch (err) {
        if (!(err?.status === 409 || /already exists/i.test(err?.message || ''))) throw err;
      }
      setStatus('PENDING_SENT');
      feedback('success');
    });
  };
  const cancelRequest = () => run(async () => { await cancelFriendRequest(id); setStatus('NONE'); });
  const acceptRequest = () => {
    if (needsAccount(`Sign in to accept ${name}'s friend request.`, 'ACCEPT_FRIEND')) return;
    run(async () => { await acceptFriendRequest(id); setStatus('ACCEPTED'); feedback('success'); });
  };
  const openChat = () => {
    navigateTo({ tab: 'friends', friendId: id });
    onClose();
  };

  const confirmAction = () => run(async () => {
    if (confirm === 'remove') {
      await removeFriend(id);
      setStatus('NONE');
      feedback('success');
      options.onRemoved?.(id);
      setConfirm(null);
      return;
    }
    if (confirm === 'report') {
      const text = details.trim() ? `${reason}: ${details.trim()}` : reason;
      await reportUser(id, text);
    } else {
      await blockUser(id);
    }
    feedback('success');
    options.onBlocked?.(id);
    onClose();
  });

  const primaryAction = () => {
    if (isSelf) return null;
    switch (effectiveStatus) {
      case 'ACCEPTED':
        return options.inChat ? (
          <div className="pc-pill pc-pill--ok"><UserCheck size={16} aria-hidden="true" />Friends</div>
        ) : (
          <button type="button" className="btn-primary pc-btn" onClick={openChat}>
            <MessageCircle size={17} aria-hidden="true" />Message
          </button>
        );
      case 'PENDING_SENT':
        return (
          <button type="button" className="btn-secondary pc-btn" onClick={cancelRequest} disabled={busy}>
            <Clock size={17} aria-hidden="true" />Request sent · Cancel
          </button>
        );
      case 'PENDING_RECEIVED':
        return (
          <button type="button" className="btn-primary pc-btn" onClick={acceptRequest} disabled={busy}>
            <UserCheck size={17} aria-hidden="true" />Accept friend request
          </button>
        );
      case 'BLOCKED':
        return <div className="pc-pill"><Ban size={16} aria-hidden="true" />Blocked</div>;
      default:
        return (
          <button type="button" className="btn-primary pc-btn" onClick={addFriend} disabled={busy}>
            <UserPlus size={17} aria-hidden="true" />Add friend
          </button>
        );
    }
  };

  const confirmCopy = {
    remove: {
      title: `Remove ${name}?`,
      body: 'They will be removed from your friends and your chat history with them is deleted. You can send them a new friend request later.',
      cta: 'Remove friend'
    },
    block: {
      title: `Block ${name}?`,
      body: "They can't message you, send you friend requests, find you in search, or be matched with you again. Any friendship and chat history is removed. You can unblock them later from the Friends tab.",
      cta: 'Block'
    },
    report: {
      title: `Block & report ${name}?`,
      body: 'They are blocked right away and our team reviews the report. They are not told who reported them.',
      cta: 'Block & report'
    }
  }[confirm] || null;

  return (
    <Portal>
      <div
        className="m-sheet-backdrop pc-backdrop"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="glass-panel m-sheet pc-card" role="dialog" aria-modal="true" aria-label={`${name}'s profile`}>
          <button type="button" className="pc-close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>

          {confirmCopy ? (
            <div className="pc-confirm">
              <button type="button" className="pc-back" onClick={() => { setConfirm(null); setError(''); }}>
                <ArrowLeft size={16} aria-hidden="true" />Back
              </button>
              <h2 className="pc-confirm__title">{confirmCopy.title}</h2>
              <p className="pc-confirm__body">{confirmCopy.body}</p>
              {confirm === 'report' && (
                <div className="pc-report">
                  <div className="pc-report__reasons" role="radiogroup" aria-label="Reason">
                    {REPORT_REASONS.map(r => (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={reason === r}
                        className={`pc-chip${reason === r ? ' is-selected' : ''}`}
                        onClick={() => setReason(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="pc-report__details"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Add details (optional)"
                    maxLength={400}
                    rows={3}
                  />
                </div>
              )}
              {error && <div className="pc-error" role="alert">{error}</div>}
              <div className="pc-confirm__actions">
                <button type="button" className="btn-secondary pc-btn" onClick={() => setConfirm(null)} disabled={busy}>
                  Cancel
                </button>
                <button type="button" className="btn-danger pc-btn pc-btn--danger" onClick={confirmAction} disabled={busy}>
                  {busy ? 'Please wait…' : confirmCopy.cta}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="pc-hero">
                <div className="pc-avatar">
                  {person.photoUrl ? (
                    <img src={person.photoUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <UserRound size={40} aria-hidden="true" />
                  )}
                  <span className={`pc-avatar__dot${online ? ' is-online' : ''}`} aria-hidden="true" />
                </div>
                <h2 className="pc-name">
                  {name}
                  {guestPeer && <span className="pc-badge pc-badge--muted">Guest</span>}
                </h2>
                {person.username && <div className="pc-username">@{person.username}</div>}
                <div className={`pc-presence${online ? ' is-online' : ''}`}>{presenceLabel(online, lastSeen)}</div>
              </div>

              {(genderLabel || distanceKm !== null) && (
                <div className="pc-facts">
                  {genderLabel && <span className="pc-fact">{genderLabel}</span>}
                  {distanceKm !== null && (
                    <span className="pc-fact">
                      <MapPin size={13} aria-hidden="true" />
                      {distanceKm < 1 ? 'Less than 1 km away' : `${distanceKm} km away`}
                    </span>
                  )}
                </div>
              )}

              {(person.bio || person.peerBio || (options.topics || []).length > 0) && (
                <div className="pc-about">
                  <PeerAbout
                    bio={person.bio || person.peerBio}
                    topics={options.topics}
                    sharedTopics={options.sharedTopics}
                  />
                </div>
              )}

              {error && <div className="pc-error" role="alert">{error}</div>}

              {!isSelf && (
                <>
                  <div className="pc-actions">{primaryAction()}</div>
                  <div className="pc-danger">
                    {effectiveStatus === 'ACCEPTED' && (
                      <button type="button" className="pc-link" onClick={() => setConfirm('remove')}>
                        <UserMinus size={16} aria-hidden="true" />Remove friend
                      </button>
                    )}
                    {effectiveStatus !== 'BLOCKED' && (
                      <>
                        <button type="button" className="pc-link pc-link--danger" onClick={() => setConfirm('block')}>
                          <Ban size={16} aria-hidden="true" />Block
                        </button>
                        <button type="button" className="pc-link pc-link--danger" onClick={() => setConfirm('report')}>
                          <Flag size={16} aria-hidden="true" />Block &amp; report
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}
