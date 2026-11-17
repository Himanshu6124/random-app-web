import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { X, UserRound, Heart } from 'lucide-react';
import { startRadarSounds, playLockOn, unlockRadarAudio } from '../services/radarSound';
import { CraftedCredit } from './CraftedCredit';
import { MATCH_TOPICS, MAX_MATCH_TOPICS, TOPIC_WINDOW_SECONDS, topicById } from '../content/matchTopics';

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

// Home headline: three lines per part of the user's local day, rotated slowly.
// The first line of each set is the plain question; the others keep it warm, never cutesy.
const DAY_PARTS = [
  { from: 5, part: 'morning', lines: ["Who's up this morning?", 'Coffee and a new hello?', 'Start the day with someone new.'] },
  { from: 12, part: 'afternoon', lines: ["Who's around this afternoon?", 'Take a break. Meet someone new.', 'A quick hello, maybe more.'] },
  { from: 17, part: 'evening', lines: ["Who's out this evening?", 'Unwind with someone new.', 'Evenings are better shared.'] },
  { from: 21, part: 'night', lines: ["Who's up tonight?", 'Late night, good company.', 'Tell a stranger about your day.'] },
  { from: 1, part: 'late night', lines: ["Can't sleep either?", 'Quiet hours, kind company.', 'Some talks only happen at night.'] }
];
const HEADLINE_SECONDS = 6;

function dayPartAt(date) {
  const h = date.getHours();
  if (h >= 21 || h === 0) return DAY_PARTS[3];
  if (h >= 17) return DAY_PARTS[2];
  if (h >= 12) return DAY_PARTS[1];
  if (h >= 5) return DAY_PARTS[0];
  return DAY_PARTS[4];
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}


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
  const { matchState, startSearching, cancelSearch, currentPeer, matchTopics, setMatchTopics, matchGender, setMatchGender } = useSocket();
  const { user, soundEnabled } = useAuth();

  const isSearching = matchState === 'searching';
  const isLocked = matchState === 'matched';

  // Sonar pings in step with the sweep while searching; a lock-on chime when a match lands
  useEffect(() => {
    if (!isSearching || !soundEnabled) return;
    return startRadarSounds(SWEEP_SECONDS, BLIPS.map(b => b.c));
  }, [isSearching, soundEnabled]);

  // The lock-on chime only plays when a search on this screen just found someone, never when
  // the tab is reopened during an ongoing chat.
  const searchedHereRef = useRef(false);
  useEffect(() => {
    if (isSearching) searchedHereRef.current = true;
  }, [isSearching]);
  useEffect(() => {
    if (!isLocked || !soundEnabled || !searchedHereRef.current) return;
    searchedHereRef.current = false;
    return playLockOn();
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

  // Idle home: follow the clock (checked each minute) and rotate the headline lines.
  const isIdle = !isSearching && !isLocked;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isIdle) return;
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, [isIdle]);
  const dayPart = dayPartAt(now);

  const [lineIdx, setLineIdx] = useState(0);
  useEffect(() => { setLineIdx(0); }, [dayPart]);
  useEffect(() => {
    if (!isIdle || prefersReducedMotion()) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') setLineIdx(i => (i + 1) % dayPart.lines.length);
    }, HEADLINE_SECONDS * 1000);
    return () => clearInterval(t);
  }, [isIdle, dayPart]);

  const peerName = currentPeer?.name || 'a stranger';
  const peerInitial = (currentPeer?.name || '').trim().charAt(0).toUpperCase();

  // No "up to 3" hint by default: the limit is only explained when someone tries a 4th.
  const [topicLimitHit, setTopicLimitHit] = useState(false);
  const limitTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(limitTimerRef.current), []);
  const toggleTopic = (id) => {
    if (matchTopics.includes(id)) {
      setMatchTopics(matchTopics.filter(t => t !== id));
      setTopicLimitHit(false);
    } else if (matchTopics.length < MAX_MATCH_TOPICS) {
      setMatchTopics([...matchTopics, id]);
    } else {
      setTopicLimitHit(true);
      clearTimeout(limitTimerRef.current);
      limitTimerRef.current = setTimeout(() => setTopicLimitHit(false), 2600);
    }
  };
  const renderChip = (t, decorative = false) => {
    const selected = matchTopics.includes(t.id);
    const full = !selected && matchTopics.length >= MAX_MATCH_TOPICS;
    return (
      <button
        key={decorative ? `${t.id}-loop` : t.id}
        type="button"
        className={`topic-chip${selected ? ' is-selected' : ''}${full ? ' is-full' : ''}`}
        aria-pressed={selected}
        aria-hidden={decorative || undefined}
        tabIndex={decorative ? -1 : undefined}
        onClick={() => toggleTopic(t.id)}
      >
        <span className="topic-chip__emoji" aria-hidden="true">{t.emoji}</span>
        {t.label}
      </button>
    );
  };
  // Phones: three rows that drift slowly (alternating direction) so it's obvious there are more.
  const topicRows = [0, 1, 2].map(r => MATCH_TOPICS.filter((_, i) => i % 3 === r));
  const topicNames = matchTopics.map(id => topicById(id)?.label).filter(Boolean).join(', ');
  const searchTopicLine = matchTopics.length === 0
    ? null
    : elapsed < TOPIC_WINDOW_SECONDS
      ? `Looking for people into ${topicNames}…`
      : 'Widening the search to everyone…';

  const formatElapsed = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const statusState = isLocked ? 'is-locked' : isSearching ? 'is-searching' : 'is-idle';

  const title = isLocked
    ? 'Someone said hello.'
    : isSearching
      ? SEARCH_PHRASES[phraseIdx]
      : dayPart.lines[lineIdx % dayPart.lines.length];

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
        {!isLocked && searchTopicLine && (
          <p className="match-search__topics">{searchTopicLine}</p>
        )}
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
        {/* The rotating line is decorative for screen readers; they get the plain question once. */}
        <h2 className="match-home__title">
          <span className="dc-sr-only">{dayPart.lines[0]}</span>
          <span key={title} className="search-phrase match-home__line" aria-hidden="true">
            {title.split(' ').map((word, i) => (
              <span key={i} className="search-phrase__word" style={{ animationDelay: `${i * 70}ms` }}>
                {word}{' '}
              </span>
            ))}
          </span>
        </h2>
        <p className="match-home__lede">
          Chat one-to-one with a random stranger.
        </p>
      </div>

      {/* Compact filters: who to meet, then an optional single row of vibes */}
      <div className="match-filters">
        <div className="match-filter-row">
          <span className="match-filter-row__label" id="meet-label">Meet</span>
          <div className="match-gender" role="radiogroup" aria-labelledby="meet-label">
            {[['any', 'Anyone'], ['boy', 'Male'], ['girl', 'Female'], ['other', 'Other']].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={matchGender === id}
                className={matchGender === id ? 'is-active' : ''}
                onClick={() => setMatchGender(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="topic-picker topic-picker--row">
          <legend className="topic-picker__label">Vibes</legend>
          <div className="topic-picker__chips topic-picker__chips--wrap">
            {MATCH_TOPICS.map(t => renderChip(t))}
          </div>
          <div className="topic-marquee">
            {topicRows.map((row, r) => (
              <div key={r} className={`topic-marquee__row topic-marquee__row--${r}`}>
                <div className="topic-marquee__track">
                  {row.map(t => renderChip(t))}
                  {row.map(t => renderChip(t, true))}
                </div>
              </div>
            ))}
          </div>
          {topicLimitHit && (
            <p className="topic-picker__limit" role="alert">
              You can pick up to {MAX_MATCH_TOPICS} vibes. Tap one you've picked to swap it.
            </p>
          )}
      </fieldset>
      </div>

      <div className="match-home__action">
        <div className="find-match">
          <button
            type="button"
            id="find-match-btn"
            onClick={() => { unlockRadarAudio(); startSearching(); }}
            className="btn-primary match-home__btn find-match-btn"
          >
            <Heart className="find-match-btn__heart" size={20} strokeWidth={2} aria-hidden="true" />
            <span>Find a Match</span>
          </button>
        </div>
      </div>

      <CraftedCredit className="match-home__credit" />
    </div>
  );
}
