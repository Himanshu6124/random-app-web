import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { discoverService } from '../../services/discoverService';
import { DiscoverAvatar } from './DiscoverAvatar';
import { FriendshipButton } from './FriendshipButton';
import { highlight, timeAgo } from './discoverUtils';
import { useProfileCard } from '../ProfileCard';

/** "Online", "Last seen 5m ago" — kept ticking so it never goes stale on screen. */
function PresenceLine({ online, lastOnline }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (online) return undefined;
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [online]);
  if (online) return <span className="dc-person-sub dc-person-sub--online">Online</span>;
  const ago = timeAgo(lastOnline);
  return <span className="dc-person-sub">{ago ? `Last seen ${ago}` : 'Offline'}</span>;
}

const seenAt = (f) => (f.isOnline ? Number.MAX_SAFE_INTEGER : (f.lastOnline ? new Date(f.lastOnline).getTime() : 0));

const MIN_CHARS = 1;
const PAGE_SIZE = 20;

/** Find friends: search everyone (guests included) by name or @username. */
export function FindFriendsPanel({ onOpenChat }) {
  const { jwtToken, friends } = useAuth();
  const { openProfile } = useProfileCard();
  // Friends first by who is online, then by who was online most recently.
  const sortedFriends = useMemo(
    () => [...friends].sort((a, b) => seenAt(b) - seenAt(a) || String(a.name || '').localeCompare(String(b.name || ''))),
    [friends]
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const typed = query.trim().replace(/^@+/, '').trim();
  // The term actually searched for; only changes when the user taps search or presses Enter.
  const [term, setTerm] = useState('');
  const abortRef = useRef(null);

  const runSearch = async (e) => {
    e?.preventDefault();
    if (typed.length < MIN_CHARS) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setTerm(typed);
    setLoading(true);
    setResults([]);
    try {
      const res = await discoverService.searchPeople(typed, { page: 0, size: PAGE_SIZE, token: jwtToken, signal: controller.signal });
      setResults(res.results);
      setHasMore(!res.last);
      setPage(0);
      setError('');
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Search failed. Please try again.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => () => abortRef.current?.abort(), []);

  const clearSearch = () => {
    abortRef.current?.abort();
    setQuery('');
    setTerm('');
    setResults([]);
    setHasMore(false);
    setError('');
    setLoading(false);
    inputRef.current?.focus();
  };

  const loadMore = async () => {
    setLoading(true);
    try {
      const res = await discoverService.searchPeople(term, { page: page + 1, size: PAGE_SIZE, token: jwtToken });
      setResults(prev => [...prev, ...res.results.filter(r => !prev.some(p => p.id === r.id))]);
      setHasMore(!res.last);
      setPage(p => p + 1);
    } catch (err) {
      setError(err.message || 'Could not load more results.');
    } finally {
      setLoading(false);
    }
  };

  const setStatus = (id, friendshipStatus) =>
    setResults(prev => prev.map(r => (r.id === id ? { ...r, friendshipStatus } : r)));

  return (
    <section className="dc-card find-card" aria-labelledby="find-friends-title">
      <div className="dc-page-title">
        <h1 id="find-friends-title">Find friends</h1>
        <p>Search by name or @username.</p>
      </div>

      <form className="dc-search dc-search--submit" role="search" onSubmit={runSearch}>
        <span className="dc-sr-only">Search people</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or @username"
          autoComplete="off"
          spellCheck={false}
          maxLength={50}
          enterKeyHint="search"
        />
        {query && (
          <button
            type="button"
            className="dc-icon-btn dc-icon-btn--ghost dc-icon-btn--sm"
            aria-label="Clear search"
            onClick={clearSearch}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
        <button
          type="submit"
          className="dc-search-submit"
          aria-label="Search"
          disabled={!typed || loading}
        >
          {loading ? <span className="dc-spinner" aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
        </button>
      </form>

      {error && <div className="dc-error" role="alert">{error}</div>}

      {!term ? (
        sortedFriends.length === 0 ? (
          <div className="dc-empty">
            <strong>Look someone up</strong>
            <span>Type a name or @username, then tap search.</span>
          </div>
        ) : (
          <>
            <span className="dc-muted">Your friends ({sortedFriends.length})</span>
            <ul className="dc-person-list">
              {sortedFriends.map(friend => {
                const fid = friend.id || friend.friendUserId;
                const fname = friend.name || friend.friendUserName || friend.username;
                return (
                  <li key={fid} className="dc-person-row dc-person-row--tappable">
                    <button
                      type="button"
                      className="dc-person-open"
                      onClick={() => openProfile({ ...friend, id: fid })}
                      aria-label={`View ${fname}'s profile`}
                    >
                      <DiscoverAvatar id={fid} name={fname} photoUrl={friend.photoUrl} online={friend.isOnline} size={48} />
                      <span className="dc-person-text">
                        <span className="dc-person-name">{fname}</span>
                        <PresenceLine online={friend.isOnline} lastOnline={friend.lastOnline} />
                      </span>
                    </button>
                    <FriendshipButton
                      personId={fid}
                      name={fname}
                      status="ACCEPTED"
                      onMessage={() => onOpenChat(fid)}
                      onError={setError}
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )
      ) : (
        <>
          <span className="dc-muted" aria-live="polite">
            {loading && results.length === 0 ? 'Searching…' : `Results for “${term}”`}
          </span>

          {!loading && results.length === 0 && !error ? (
            <div className="dc-empty">
              <strong>No one found</strong>
              <span>Check the spelling, or try part of their @username.</span>
            </div>
          ) : (
            <ul className="dc-person-list">
              {results.map(person => (
                <li key={person.id} className="dc-person-row dc-person-row--tappable">
                  <button
                    type="button"
                    className="dc-person-open"
                    onClick={() => openProfile(person, { onBlocked: () => setStatus(person.id, 'BLOCKED') })}
                    aria-label={`View ${person.name}'s profile`}
                  >
                    <DiscoverAvatar
                      id={person.id}
                      name={person.name}
                      photoUrl={person.photoUrl}
                      online={person.isOnline}
                      size={48}
                    />
                    <span className="dc-person-text">
                      <span className="dc-person-name">{highlight(person.name, term)}</span>
                      <span className="dc-person-sub">@{highlight(person.username, term)}</span>
                    </span>
                  </button>
                  <FriendshipButton
                    personId={person.id}
                    name={person.name}
                    status={person.friendshipStatus}
                    onStatusChange={(s) => setStatus(person.id, s)}
                    onMessage={() => onOpenChat(person.id)}
                    onError={setError}
                  />
                </li>
              ))}
            </ul>
          )}

          {hasMore && (
            <button type="button" className="dc-btn dc-btn--ghost dc-btn--sm" style={{ alignSelf: 'center' }} onClick={loadMore} disabled={loading}>
              Show more people
            </button>
          )}
        </>
      )}
    </section>
  );
}
