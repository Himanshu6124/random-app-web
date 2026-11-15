import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { X, UserRound } from 'lucide-react';
import { startRadarSounds, playLockOn, unlockRadarAudio } from '../services/radarSound';

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

// Radar blips: anonymous people out there, placed by compass angle (deg, 0 = up)
// and distance from centre (% of the radar's width). The sweep pings each one as it passes.
const SWEEP_SECONDS = 3;
// Each one wears one of the app's profile avatars.
const BLIPS = [
  { c: 40, r: 36, img: '/userImages/girl2.png' },
  { c: 112, r: 46, img: '/userImages/boy3.png' },
  { c: 168, r: 29, img: '/userImages/girl5.png' },
  { c: 224, r: 44, img: '/userImages/boy6.png' },
  { c: 292, r: 33, img: '/userImages/girl7.png' },
  { c: 336, r: 46, img: '/userImages/boy2.png' }
];
const TARGET = 0; // the blip the radar locks onto when a match lands

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
  const { matchState, startSearching, cancelSearch, currentPeer } = useSocket();
  const { user, soundEnabled } = useAuth();

  const isSearching = matchState === 'searching';
  const isLocked = matchState === 'matched';

  // Sonar pings in step with the sweep while searching; a lock-on chime when a match lands
  useEffect(() => {
    if (!isSearching || !soundEnabled) return;
    return startRadarSounds(SWEEP_SECONDS, BLIPS.map(b => b.c));
  }, [isSearching, soundEnabled]);

  useEffect(() => {
    if (isLocked && soundEnabled) playLockOn();
  }, [isLocked, soundEnabled]);

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

  const peerName = currentPeer?.name || 'a stranger';
  const peerInitial = (currentPeer?.name || '').trim().charAt(0).toUpperCase();

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
        <div className="match-search__stage radar" aria-hidden="true">
          <span className="radar__ring radar__ring--1" />
          <span className="radar__ring radar__ring--2" />
          <span className="radar__ring radar__ring--3" />
          <span className="radar__sweep" style={{ animationDuration: `${SWEEP_SECONDS}s` }} />

          {BLIPS.map((b, i) => {
            const isTarget = i === TARGET;
            return (
              <span
                key={i}
                className={`radar__blip${isTarget ? ' radar__blip--target' : ''}`}
                style={{
                  '--c': `${b.c}deg`,
                  '--r': `${b.r}cqw`,
                  animationDelay: `${(b.c / 360) * SWEEP_SECONDS}s`,
                  animationDuration: `${SWEEP_SECONDS}s`
                }}
              >
                <img src={b.img} alt="" onError={e => { e.target.style.display = 'none'; }} />
                {isTarget && isLocked && (
                  <span className="radar__peer">
                    {currentPeer?.photoUrl
                      ? <img src={currentPeer.photoUrl} alt="" onError={e => { e.target.style.display = 'none'; }} />
                      : peerInitial
                        ? <span className="radar__initial">{peerInitial}</span>
                        : <UserRound aria-hidden="true" />}
                  </span>
                )}
                {isTarget && <span className="radar__lock" />}
              </span>
            );
          })}

          {isLocked ? <HeartBurst className="heart-burst--big" /> : <HeartBurst key="start" />}
          <span className="match-search__avatar">
            {user?.photoUrl
              ? <img src={user.photoUrl} alt="" onError={e => { e.target.style.display = 'none'; }} />
              : <UserRound size={32} />}
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
          {isLocked ? `Matched with ${peerName}` : `Searching · ${formatElapsed(elapsed)}`}
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
          onClick={() => { unlockRadarAudio(); startSearching(); }}
          className="btn-primary match-home__btn find-match-btn"
        >
          <span>Find a Match</span>
        </button>
      </div>
    </div>
  );
}
