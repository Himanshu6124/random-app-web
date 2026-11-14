import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { X, UserRound } from 'lucide-react';

/**
 * MatchRadar — Match tab home + search.
 * States: idle → searching → matched (the chat then slides in).
 */
const SEARCH_PHRASES = [
  'Finding a new soul…',
  'Someone out there is awake too…',
  'Looking for your kind of person…',
  'Every story starts with hello…',
  'Matching you with a kindred soul…',
  'Almost there…'
];

// Small heart outlines that drift up around your avatar while searching
const FLOAT_HEARTS = [
  { x: '6%', size: 26, delay: '0s', dur: '5.2s' },
  { x: '80%', size: 20, delay: '1.1s', dur: '4.6s' },
  { x: '24%', size: 16, delay: '2.3s', dur: '5.8s' },
  { x: '66%', size: 28, delay: '3.0s', dur: '5s' },
  { x: '46%', size: 18, delay: '4.1s', dur: '4.4s' }
];

// Heart outlines that burst up and outward once (upper half only)
const BURST_ANGLES = [-80, -55, -30, -10, 10, 30, 55, 80];
function HeartBurst({ className = '' }) {
  return (
    <span className={`heart-burst ${className}`} aria-hidden="true">
      {BURST_ANGLES.map((a, i) => (
        <svg key={i} viewBox="0 0 24 24" style={{ '--a': `${a}deg` }}>
          <path d="M12 20.5C9 18.2 4 14.6 4 9.8 4 7.2 6 5.2 8.4 5.2c1.5 0 2.8.8 3.6 2 .8-1.2 2.1-2 3.6-2C18 5.2 20 7.2 20 9.8c0 4.8-5 8.4-8 10.7Z" />
        </svg>
      ))}
    </span>
  );
}

export function MatchRadar() {
  const { matchState, startSearching, cancelSearch } = useSocket();
  const { user } = useAuth();

  const isSearching = matchState === 'searching';
  const isLocked = matchState === 'matched';

  // Elapsed time counter shown while searching
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isSearching) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isSearching]);

  // Rotating search lines: each one rises in word by word
  const [phraseIdx, setPhraseIdx] = useState(0);
  useEffect(() => {
    if (!isSearching) { setPhraseIdx(0); return; }
    const t = setInterval(() => setPhraseIdx(i => (i + 1) % SEARCH_PHRASES.length), 4000);
    return () => clearInterval(t);
  }, [isSearching]);

  const formatElapsed = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const statusState = isLocked ? 'is-locked' : isSearching ? 'is-searching' : 'is-idle';

  const title = isLocked
    ? 'Someone said hello.'
    : isSearching
      ? SEARCH_PHRASES[phraseIdx]
      : "Who's up tonight?";

  if (isSearching || isLocked) {
    return (
      <div className={`radar-container match-home match-search ${statusState}`}>
        <div className="match-search__stage" aria-hidden="true">
          {FLOAT_HEARTS.map((h, i) => (
            <svg
              key={i}
              className="match-search__heart"
              viewBox="0 0 24 24"
              style={{ left: h.x, width: h.size, height: h.size, animationDelay: h.delay, animationDuration: h.dur }}
            >
              <path d="M12 20.5C9 18.2 4 14.6 4 9.8 4 7.2 6 5.2 8.4 5.2c1.5 0 2.8.8 3.6 2 .8-1.2 2.1-2 3.6-2C18 5.2 20 7.2 20 9.8c0 4.8-5 8.4-8 10.7Z" />
            </svg>
          ))}
          {isLocked ? <HeartBurst className="heart-burst--big" /> : <HeartBurst key="start" />}
          <span className="match-search__avatar">
            {user?.photoUrl
              ? <img src={user.photoUrl} alt="" onError={e => { e.target.style.display = 'none'; }} />
              : <UserRound size={40} />}
          </span>
        </div>

        <div className="match-search__words">
        <h2 className="match-search__phrase" aria-live="polite">
          <span key={title} className="search-phrase">
            {title.split(' ').map((word, i) => (
              <span key={i} className="search-phrase__word" style={{ animationDelay: `${i * 70}ms` }}>
                {word}{' '}
              </span>
            ))}
          </span>
        </h2>

        <p className="match-search__timer" role="status">
          {isLocked ? 'Opening your chat' : `Searching · ${formatElapsed(elapsed)}`}
        </p>
        </div>

        <div className="match-home__action">
          <button
            type="button"
            onClick={cancelSearch}
            className="btn-secondary match-home__btn"
            disabled={isLocked}
          >
            <X size={18} aria-hidden="true" />
            <span>Cancel</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="radar-container match-home">
      <div className="match-home__copy">
        <h2 className="match-home__title">{title}</h2>
        <p className="match-home__lede">
          Chat one-to-one with a random stranger. Keep the ones you click with.
        </p>
      </div>

      <p className="match-status is-idle">
        <span className="match-status__dot" aria-hidden="true" />
        Ready when you are
      </p>

      <div className="match-home__action">
        <button
          type="button"
          id="find-match-btn"
          onClick={startSearching}
          className="btn-primary match-home__btn find-match-btn"
        >
          <span>Find a Match</span>
        </button>
      </div>
    </div>
  );
}
