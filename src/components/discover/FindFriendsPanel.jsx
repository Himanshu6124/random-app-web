import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { discoverService } from '../../services/discoverService';
import { DiscoverAvatar } from './DiscoverAvatar';
import { FriendshipButton } from './FriendshipButton';
import { highlight } from './discoverUtils';

const MIN_CHARS = 2;
const PAGE_SIZE = 20;

/** Find friends: search registered people by name or @username. */
export function FindFriendsPanel({ onOpenChat }) {
  const { jwtToken } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const term = query.trim().replace(/^@+/, '').trim();
  const searchable = term.length >= MIN_CHARS;

  // Debounced search; an in-flight request is aborted when the query changes.
  useEffect(() => {
    if (!searchable) {
      setResults([]);
      setHasMore(false);
      setError('');
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await discoverService.searchPeople(term, { page: 0, size: PAGE_SIZE, token: jwtToken, signal: controller.signal });
        setResults(res.results);
        setHasMore(!res.last);
        setPage(0);
        setError('');
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || 'Search failed. Please try again.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, searchable, jwtToken]);

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

      <label className="dc-search">
        <Search size={18} aria-hidden="true" />
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
        />
        {loading && <span className="dc-spinner" aria-hidden="true" />}
        {query && (
          <button
            type="button"
            className="dc-icon-btn dc-icon-btn--ghost dc-icon-btn--sm"
            aria-label="Clear search"
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </label>

      {error && <div className="dc-error" role="alert">{error}</div>}

      {!searchable ? (
        <div className="dc-empty">
          <strong>Look someone up</strong>
          <span>Type at least {MIN_CHARS} letters of a name or @username.</span>
        </div>
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
                <li key={person.id} className="dc-person-row">
                  <DiscoverAvatar
                    id={person.id}
                    name={person.name}
                    photoUrl={person.photoUrl}
                    online={person.isOnline}
                    size={48}
                  />
                  <div className="dc-person-text">
                    <span className="dc-person-name">{highlight(person.name, term)}</span>
                    <span className="dc-person-sub">@{highlight(person.username, term)}</span>
                  </div>
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
