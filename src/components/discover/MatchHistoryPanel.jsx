import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Trash2, Clock, MoreHorizontal, MessageCircle, Ban, Flag, X, Lock, UserPlus, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { discoverService } from '../../services/discoverService';
import { DiscoverAvatar } from './DiscoverAvatar';
import { FriendshipButton } from './FriendshipButton';
import { DiscoverConfirmDialog } from './DiscoverConfirmDialog';
import { OUTCOMES, dayGroupOf, firstName, formatDuration, matchTimeLabel, matchedLabel } from './discoverUtils';

const FILTERS = [
  { id: 'all', label: 'All', short: 'All' },
  { id: 'friends', label: 'Became friends', short: 'Friends' },
  { id: 'pending', label: 'Request pending', short: 'Pending' },
  { id: 'ended', label: 'Chat ended', short: 'Ended' },
  { id: 'reported', label: 'Reported', short: 'Reported' }
];
const PAGE_SIZE = 20;
const GROUP_ORDER = ['Today', 'Yesterday', 'Earlier this week', 'Earlier'];

function OutcomeBadge({ outcome }) {
  const o = OUTCOMES[outcome] || OUTCOMES.CHAT_ENDED;
  return <span className={`dc-badge${o.tone ? ` dc-badge--${o.tone}` : ''}`}>{o.label}</span>;
}

function chatLength(item) {
  if (item.outcome === 'IN_PROGRESS' || (!item.endedAt && item.durationSeconds == null)) return null;
  return formatDuration(item.durationSeconds);
}

/** Outcome after a friendship change made from history (reported rows stay reported). */
function outcomeFor(item, status) {
  if (item.reported) return 'REPORTED';
  if (status === 'ACCEPTED') return 'BECAME_FRIENDS';
  if (status === 'PENDING_SENT') return 'REQUEST_SENT';
  if (status === 'PENDING_RECEIVED') return 'REQUEST_RECEIVED';
  if (!item.endedAt) return 'IN_PROGRESS';
  return item.endedByPeer ? 'THEY_SKIPPED' : 'CHAT_ENDED';
}

/** Match history: everyone met in Random Match in the retention window. Owner-only. */
export function MatchHistoryPanel({ onOpenChat }) {
  const { jwtToken, sendFriendRequest, acceptFriendRequest } = useAuth();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const requestSeq = useRef(0);

  const loadStats = useCallback(async () => {
    try {
      setStats(await discoverService.getMatchHistoryStats(jwtToken));
    } catch (err) {
      setError(err.message || 'Could not load history stats.');
    }
  }, [jwtToken]);

  const loadPage = useCallback(async (nextPage, { append = false } = {}) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const res = await discoverService.getMatchHistory({ filter, q: query.trim(), page: nextPage, size: PAGE_SIZE, token: jwtToken });
      if (seq !== requestSeq.current) return;
      setItems(prev => (append ? [...prev, ...res.items] : res.items));
      setHasMore(!res.last);
      setPage(nextPage);
      setError('');
    } catch (err) {
      if (seq === requestSeq.current) setError(err.message || 'Could not load match history.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [filter, query, jwtToken]);

  useEffect(() => {
    const timer = setTimeout(() => loadPage(0), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadPage, query]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Keep the detail panel on a row that is actually listed
  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(null);
    } else if (!items.some(i => i.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  // Close the row menu on outside click / Escape
  useEffect(() => {
    if (!menuId) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'mousedown' && e.target.closest?.('.history-menu, [data-menu-trigger]')) return;
      setMenuId(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuId]);

  const selected = items.find(i => i.id === selectedId) || null;

  const patchItem = (id, patch) => setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));

  const onFriendshipChange = (item, status) => {
    // The same person can appear in several rows (met more than once)
    setItems(prev => prev.map(i => (i.peerId === item.peerId ? { ...i, friendshipStatus: status, outcome: outcomeFor(i, status) } : i)));
    loadStats();
  };

  const runConfirmed = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const { kind, item } = confirm;
      if (kind === 'clear') {
        await discoverService.clearMatchHistory(jwtToken);
        setItems([]);
        setHasMore(false);
      } else if (kind === 'remove') {
        await discoverService.removeMatchHistoryEntry(item.id, jwtToken);
        setItems(prev => prev.filter(i => i.id !== item.id));
      } else if (kind === 'report') {
        const updated = await discoverService.reportMatch(item.id, jwtToken);
        patchItem(item.id, updated);
      } else if (kind === 'block') {
        const updated = await discoverService.blockMatch(item.id, jwtToken);
        setItems(prev => prev.map(i => (i.peerId === item.peerId
          ? { ...i, friendshipStatus: 'BLOCKED', outcome: i.id === item.id ? updated.outcome : outcomeFor(i, 'BLOCKED') }
          : i)));
      }
      setConfirm(null);
      loadStats();
    } catch (err) {
      setError(err.message || 'That did not work. Please try again.');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const askConfirm = (kind, item) => {
    setMenuId(null);
    const name = item?.peerName;
    const copy = {
      clear: {
        title: 'Clear match history?',
        body: 'This removes everyone from your history for good. Friends and friend requests are not affected.',
        confirmLabel: 'Clear history'
      },
      remove: {
        title: `Remove ${name} from history?`,
        body: 'Only this entry is removed. It does not unfriend or notify them.',
        confirmLabel: 'Remove'
      },
      report: {
        title: `Report ${name}?`,
        body: 'They will be marked as reported in your history. They are not told who reported them.',
        confirmLabel: 'Report'
      },
      block: {
        title: `Block ${name}?`,
        body: 'You will not be matched with them again, they cannot find you in search or send you requests, and any friendship and chat with them is removed. You can unblock later.',
        confirmLabel: 'Block'
      }
    }[kind];
    setConfirm({ kind, item, ...copy });
  };

  const groups = useMemo(() => {
    const map = new Map();
    items.forEach(item => {
      const g = dayGroupOf(item.matchedAt);
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(item);
    });
    return GROUP_ORDER.filter(g => map.has(g)).map(g => ({ title: g, items: map.get(g) }));
  }, [items]);

  const counts = stats?.filterCounts || {};
  const weekDelta = stats ? stats.matchesThisWeek - stats.matchesLastWeek : 0;

  const primaryAction = (item, size = 'sm') => {
    if (item.peerGuest) return null;
    if (item.friendshipStatus === 'ACCEPTED') {
      return (
        <button type="button" className="dc-btn dc-btn--soft dc-btn--sm" onClick={(e) => { e.stopPropagation(); onOpenChat(item.peerId); }}>
          <MessageCircle size={16} aria-hidden="true" />Message
        </button>
      );
    }
    return (
      <span onClick={(e) => e.stopPropagation()} style={{ display: 'contents' }}>
        <FriendshipButton
          personId={item.peerId}
          name={item.peerName}
          status={item.friendshipStatus}
          size={size}
          onStatusChange={(s) => onFriendshipChange(item, s)}
          onMessage={() => onOpenChat(item.peerId)}
          onError={setError}
        />
      </span>
    );
  };

  const menuFriendAction = async (item, action, nextStatus) => {
    setMenuId(null);
    try {
      await action(item.peerId);
      onFriendshipChange(item, nextStatus);
    } catch (err) {
      setError(err.message || 'That did not work. Please try again.');
    }
  };

  const rowMenu = (item) => (
    <div className="history-menu" role="menu" aria-label={`Actions for ${item.peerName}`}>
      {item.friendshipStatus === 'ACCEPTED' && (
        <button type="button" role="menuitem" onClick={() => { setMenuId(null); onOpenChat(item.peerId); }}>
          <MessageCircle size={16} aria-hidden="true" />Message
        </button>
      )}
      {/* The row's primary action, for narrow screens where it is hidden */}
      {!item.peerGuest && item.friendshipStatus === 'NONE' && (
        <button type="button" role="menuitem" className="history-menu-mobile-only" onClick={() => menuFriendAction(item, sendFriendRequest, 'PENDING_SENT')}>
          <UserPlus size={16} aria-hidden="true" />Add friend
        </button>
      )}
      {!item.peerGuest && item.friendshipStatus === 'PENDING_RECEIVED' && (
        <button type="button" role="menuitem" className="history-menu-mobile-only" onClick={() => menuFriendAction(item, acceptFriendRequest, 'ACCEPTED')}>
          <UserCheck size={16} aria-hidden="true" />Accept friend request
        </button>
      )}
      <button type="button" role="menuitem" disabled={item.reported} onClick={() => askConfirm('report', item)} className={item.reported ? '' : 'is-danger'}>
        <Flag size={16} aria-hidden="true" />{item.reported ? 'Reported' : 'Report'}
      </button>
      {!item.peerGuest && (
        <button type="button" role="menuitem" disabled={item.friendshipStatus === 'BLOCKED'} onClick={() => askConfirm('block', item)}>
          <Ban size={16} aria-hidden="true" />{item.friendshipStatus === 'BLOCKED' ? 'Blocked' : 'Block'}
        </button>
      )}
      <button type="button" role="menuitem" onClick={() => askConfirm('remove', item)}>
        <X size={16} aria-hidden="true" />Remove from history
      </button>
    </div>
  );

  return (
    <>
      <div className="dc-page-head">
        <div className="dc-page-title">
          <h1>Match history</h1>
          <p>Everyone you’ve met in Random Match in the last {stats?.retentionDays || 30} days. Only you can see this.</p>
        </div>
        <div className="history-head-controls" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 260, maxWidth: '100%' }}>
            <label className="dc-search dc-search--compact">
              <Search size={18} aria-hidden="true" />
              <span className="dc-sr-only">Search match history</span>
              <input type="search" placeholder="Search history" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={50} />
            </label>
          </div>
          <button
            type="button"
            className="dc-btn dc-btn--ghost dc-btn--sm"
            aria-label="Clear history"
            onClick={() => askConfirm('clear')}
            disabled={!stats?.totalMatches}
          >
            <Trash2 size={16} aria-hidden="true" /><span className="dc-btn-label-desktop">Clear history</span>
          </button>
        </div>
      </div>

      <div className="history-stats">
        <div className="history-stat">
          <span className="history-stat-label">Matches this week</span>
          <span className="history-stat-value">{stats ? stats.matchesThisWeek : '–'}</span>
          <span className="history-stat-sub">
            {stats ? (weekDelta === 0 ? 'same as last week' : `${weekDelta > 0 ? '+' : ''}${weekDelta} vs last week`) : ' '}
          </span>
        </div>
        <div className="history-stat">
          <span className="history-stat-label">Friends made</span>
          <span className="history-stat-value" style={{ color: 'var(--dc-green)' }}>{stats ? stats.friendsMade : '–'}</span>
          <span className="history-stat-sub">{stats ? `from ${stats.totalMatches} ${stats.totalMatches === 1 ? 'match' : 'matches'}` : ' '}</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-label">Average chat</span>
          <span className="history-stat-value" style={{ color: 'var(--dc-violet-soft)' }}>
            {stats?.averageChatSeconds != null ? formatDuration(stats.averageChatSeconds) : '–'}
          </span>
          <span className="history-stat-sub">last {stats?.retentionDays || 30} days</span>
        </div>
        <div className="history-stat">
          <span className="history-stat-label">Longest chat</span>
          <span className="history-stat-value" style={{ color: 'var(--dc-cyan)' }}>
            {stats?.longestChatSeconds != null ? formatDuration(stats.longestChatSeconds, { compact: true }) : '–'}
          </span>
          <span className="history-stat-sub">{stats?.longestChatPeerName ? `with ${firstName(stats.longestChatPeerName)}` : ' '}</span>
        </div>
      </div>

      {error && <div className="dc-error" role="alert">{error}</div>}

      <div className="history-body">
        <section className="dc-card history-list-card" aria-label="Matches">
          <div className="history-filters" role="group" aria-label="Filter matches">
            {FILTERS.map(f => (
              <button
                key={f.id}
                type="button"
                className="history-chip"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                <span className="dc-btn-label-desktop">{f.label}</span>
                <span className="history-chip-mobile-label" aria-hidden="true">{f.short}</span>
                {counts[f.id] > 0 && <span className="history-chip-count">{counts[f.id]}</span>}
              </button>
            ))}
          </div>

          {loading && items.length === 0 ? (
            <div className="dc-empty" aria-live="polite"><span className="dc-spinner" aria-hidden="true" />Loading history…</div>
          ) : items.length === 0 ? (
            <div className="dc-empty">
              <strong>{query || filter !== 'all' ? 'Nothing here' : 'No matches yet'}</strong>
              <span>
                {query || filter !== 'all'
                  ? 'No matches fit this search or filter.'
                  : 'People you meet in Random Match will show up here.'}
              </span>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.title} className="history-group">
                <h3>{group.title}</h3>
                <ul role="listbox" aria-label={`${group.title} matches`}>
                  {group.items.map(item => {
                    const length = chatLength(item);
                    const meta = `${matchTimeLabel(item.matchedAt)}${length ? ` · chatted ${length}` : item.outcome === 'IN_PROGRESS' ? ' · chatting now' : ''}`;
                    return (
                      <li
                        key={item.id}
                        className="history-row"
                        role="option"
                        aria-selected={selectedId === item.id}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <DiscoverAvatar
                          id={item.peerId}
                          name={item.peerName}
                          photoUrl={item.peerPhotoUrl}
                          online={item.peerOnline}
                          guest={item.peerGuest}
                          size={46}
                        />
                        <div className="history-row-text">
                          <div className="history-row-title">
                            <span className="dc-person-name">{item.peerName}</span>
                            <span className="dc-person-sub">{item.peerGuest ? 'Guest account' : `@${item.peerUsername}`}</span>
                          </div>
                          <span className="history-row-meta history-row-meta--desktop">
                            <Clock size={14} aria-hidden="true" />{meta}
                          </span>
                          <span className="history-row-mobile-meta">
                            <OutcomeBadge outcome={item.outcome} />
                            {length && <span>{length}</span>}
                          </span>
                        </div>
                        <OutcomeBadge outcome={item.outcome} />
                        <div className="history-row-actions">
                          <span className="history-row-primary">{primaryAction(item)}</span>
                          <button
                            type="button"
                            className="dc-icon-btn dc-icon-btn--ghost"
                            data-menu-trigger
                            aria-label={`More actions for ${item.peerName}`}
                            aria-haspopup="menu"
                            aria-expanded={menuId === item.id}
                            onClick={(e) => { e.stopPropagation(); setMenuId(menuId === item.id ? null : item.id); }}
                          >
                            <MoreHorizontal size={18} aria-hidden="true" />
                          </button>
                        </div>
                        {menuId === item.id && rowMenu(item)}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}

          {hasMore && (
            <button
              type="button"
              className="dc-btn dc-btn--ghost dc-btn--sm"
              style={{ alignSelf: 'center' }}
              onClick={() => loadPage(page + 1, { append: true })}
              disabled={loading}
            >
              Load older matches
            </button>
          )}
        </section>

        {selected && (
          <section className="dc-card history-detail" aria-label={`Match with ${selected.peerName}`}>
            <div className="history-detail-head">
              <DiscoverAvatar
                id={selected.peerId}
                name={selected.peerName}
                photoUrl={selected.peerPhotoUrl}
                online={selected.peerOnline}
                guest={selected.peerGuest}
                size={72}
              />
              <h2>{selected.peerName}</h2>
              <span className="dc-muted">{selected.peerGuest ? 'Guest account' : `@${selected.peerUsername}`}</span>
              <OutcomeBadge outcome={selected.outcome} />
            </div>

            <dl className="history-facts">
              <div><dt>Matched</dt><dd>{matchedLabel(selected.matchedAt)}</dd></div>
              <div><dt>Chat length</dt><dd>{chatLength(selected) || (selected.outcome === 'IN_PROGRESS' ? 'Ongoing' : 'Unknown')}</dd></div>
              <div><dt>Messages</dt><dd>{selected.endedAt ? selected.messageCount : '–'}</dd></div>
              <div>
                <dt>Ended by</dt>
                <dd>{selected.endedByPeer == null ? '–' : selected.endedByPeer ? firstName(selected.peerName) : 'You'}</dd>
              </div>
            </dl>

            <p className="history-note">
              <Lock size={14} aria-hidden="true" />
              Random chats aren’t stored. History keeps only who you met and when.
            </p>

            <div className="history-detail-actions">
              {selected.friendshipStatus === 'ACCEPTED' ? (
                <button type="button" className="dc-btn dc-btn--primary dc-btn--block" onClick={() => onOpenChat(selected.peerId)}>
                  <MessageCircle size={16} aria-hidden="true" />Open chat
                </button>
              ) : !selected.peerGuest && (
                <div className="history-detail-primary" style={{ display: 'flex' }}>
                  <FriendshipButton
                    personId={selected.peerId}
                    name={selected.peerName}
                    status={selected.friendshipStatus}
                    onStatusChange={(s) => onFriendshipChange(selected, s)}
                    onMessage={() => onOpenChat(selected.peerId)}
                    onError={setError}
                  />
                </div>
              )}
              <div>
                {!selected.peerGuest && (
                  <button
                    type="button"
                    className="dc-btn dc-btn--ghost dc-btn--sm"
                    disabled={selected.friendshipStatus === 'BLOCKED'}
                    onClick={() => askConfirm('block', selected)}
                  >
                    <Ban size={16} aria-hidden="true" />{selected.friendshipStatus === 'BLOCKED' ? 'Blocked' : 'Block'}
                  </button>
                )}
                <button
                  type="button"
                  className="dc-btn dc-btn--danger dc-btn--sm"
                  disabled={selected.reported}
                  onClick={() => askConfirm('report', selected)}
                >
                  <Flag size={16} aria-hidden="true" />{selected.reported ? 'Reported' : 'Report'}
                </button>
                <button type="button" className="dc-btn dc-btn--ghost dc-btn--sm" onClick={() => askConfirm('remove', selected)}>
                  <X size={16} aria-hidden="true" />Remove
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      <DiscoverConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        body={confirm?.body}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.kind !== 'remove'}
        busy={busy}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
