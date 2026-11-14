import React, { useEffect, useRef, useState } from 'react';
import { X, RotateCw, Send, PenLine, Sparkles, Flame, Scale } from 'lucide-react';
import '../styles/bottleGame.css';
import { playSpin, playLand, playChoose, unlockGameAudio } from '../services/gameFx';

/** How long the bottle spins. The server's spin cooldown (4s) is just above this. */
const SPIN_MS = 3400;
const SPIN_MS_REDUCED = 700;

const GAME_CHOICES = {
  TRUTH: { label: 'Truth', hint: 'Answer honestly', Icon: Sparkles, tone: 'truth' },
  DARE: { label: 'Dare', hint: 'Do it in the chat', Icon: Flame, tone: 'dare' },
  WOULD_YOU_RATHER: { label: 'Would you rather', hint: 'Pick one, say why', Icon: Scale, tone: 'wyr' }
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Seat({ name, photoUrl, isLanded, position, you }) {
  const [broken, setBroken] = useState(false);
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div className={`bg-seat bg-seat--${position}${isLanded ? ' bg-seat--landed' : ''}`}>
      <div className="bg-seat__face">
        {photoUrl && !broken
          ? <img src={photoUrl} alt="" onError={() => setBroken(true)} />
          : <span>{initial}</span>}
      </div>
      <span className="bg-seat__name">{you ? 'You' : name}</span>
    </div>
  );
}

/** A glass bottle drawn neck-up, so rotate(0) points at the top seat (the peer). */
function Bottle() {
  return (
    <svg className="bg-bottle__svg" viewBox="0 0 60 160" aria-hidden="true">
      <defs>
        <linearGradient id="bgGlass" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#7a2f45" />
          <stop offset="0.45" stopColor="#c9506b" />
          <stop offset="1" stopColor="#5c2034" />
        </linearGradient>
        <linearGradient id="bgCap" x1="0" x2="1">
          <stop offset="0" stopColor="#b8913f" />
          <stop offset="0.5" stopColor="#f3d79a" />
          <stop offset="1" stopColor="#a8822f" />
        </linearGradient>
      </defs>
      {/* body + shoulder + neck as one silhouette */}
      <path
        d="M24 14 h12 v30 c0 8 14 14 14 30 v68 c0 7 -5 12 -12 12 h-16 c-7 0 -12 -5 -12 -12 v-68 c0 -16 14 -22 14 -30 z"
        fill="url(#bgGlass)"
      />
      {/* label */}
      <rect x="12" y="92" width="36" height="30" rx="4" fill="#f5ecef" opacity="0.14" />
      <path d="M30 101 c-2.6 -3 -7 -1.4 -7 2 0 3.4 4.4 6 7 8 2.6 -2 7 -4.6 7 -8 0 -3.4 -4.4 -5 -7 -2 z" fill="#f5ecef" opacity="0.5" />
      {/* glass highlight */}
      <path d="M16 80 c0 -6 3 -10 6 -13 v70 c-3 0 -6 -2 -6 -6 z" fill="#ffffff" opacity="0.22" />
      <rect x="27" y="18" width="2.4" height="26" rx="1.2" fill="#ffffff" opacity="0.28" />
      {/* gold lip: the pointer */}
      <rect x="21.5" y="4" width="17" height="12" rx="3" fill="url(#bgCap)" />
    </svg>
  );
}

/**
 * Truth & Dare (spin the bottle) dialog, shown over the (blurred) chat screen for both players. The server decides everything; this only
 * animates the bottle onto `game.targetId` and lets that player pick Truth / Dare / WYR.
 */
export function BottleGame({ game, myId, me, peer, disabled, onSpin, onChoose, onAsk, onClose, spinPending = false, soundEnabled = true }) {
  const angleRef = useRef(0);
  const animatedRoundRef = useRef(null);
  const [angle, setAngle] = useState(0);
  const [spinMs, setSpinMs] = useState(0);
  const [landedRound, setLandedRound] = useState(null);
  const [choosing, setChoosing] = useState(false);
  const [spinRequested, setSpinRequested] = useState(spinPending);

  const roundId = game?.roundId || null;
  const targetIsMe = Boolean(game && game.targetId === myId);

  // The time (ms epoch) the current round's bottle comes to rest, set once per round.
  const landAtRef = useRef(0);
  const stopSpinFxRef = useRef(null);
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  // Animate each new round once, onto the side the server picked. The landing timer is
  // re-armed on every run (StrictMode, prop changes), so the round always lands; before,
  // a cleanup could clear the timer and the target never saw the Truth / Dare buttons.
  useEffect(() => {
    if (!game || !roundId) return undefined;

    if (animatedRoundRef.current !== roundId) {
      animatedRoundRef.current = roundId;
      setChoosing(false);

      const base = game.targetId === myId ? 180 : 0; // me = bottom seat, peer = top seat
      const current = angleRef.current;
      const settled = current - (((current % 360) + 360) % 360);
      const next = settled + (game.turns || 5) * 360 + base + (game.offsetDeg || 0);

      // Re-opened long after the spin (or the question already arrived): no replay.
      const stale = game.phase !== 'SPIN' || Date.now() - (game.receivedAt || 0) > SPIN_MS;
      const duration = stale ? 0 : (prefersReducedMotion() ? SPIN_MS_REDUCED : SPIN_MS);

      // An old round shown on open must not cancel a spin we just asked for.
      if (!stale) setSpinRequested(false);
      angleRef.current = next;
      landAtRef.current = Date.now() + duration;
      setSpinMs(duration);
      setAngle(next);

      if (duration === 0) {
        setLandedRound(roundId);
        return undefined;
      }
      setLandedRound(null);
      stopSpinFxRef.current?.();
      stopSpinFxRef.current = playSpin(duration, { sound: soundRef.current });
    }

    const remaining = landAtRef.current - Date.now();
    if (remaining <= 0) {
      setLandedRound(roundId);
      return undefined;
    }
    const timer = setTimeout(() => setLandedRound(roundId), remaining + 60);
    return () => clearTimeout(timer);
  }, [game, roundId, myId]);

  // Stop ticks / vibration if the dialog closes mid-spin.
  useEffect(() => () => stopSpinFxRef.current?.(), []);

  const landed = Boolean(roundId && landedRound === roundId);
  const landFxRoundRef = useRef(null);
  useEffect(() => {
    if (!landed || landFxRoundRef.current === roundId || game?.phase !== 'SPIN') return;
    landFxRoundRef.current = roundId;
    playLand(targetIsMe, { sound: soundRef.current });
  }, [landed, roundId, targetIsMe, game?.phase]);
  const spinning = Boolean(roundId && !landed);
  const awaitingChoice = landed && game.phase === 'SPIN';
  const writingQuestion = landed && game.phase === 'CHOSEN';
  const iAmAsker = Boolean(game && game.askerId ? game.askerId === myId : !targetIsMe);
  const chosenMeta = writingQuestion ? (GAME_CHOICES[game.choice] || GAME_CHOICES.TRUTH) : null;
  const showQuestion = landed && game.phase === 'QUESTION';

  // A refused spin (cooldown, peer still choosing) never gets an event: re-enable the button.
  useEffect(() => {
    if (!spinRequested) return undefined;
    const t = setTimeout(() => setSpinRequested(false), 2500);
    return () => clearTimeout(t);
  }, [spinRequested]);

  const handleSpin = () => {
    if (disabled || spinning || spinRequested) return;
    unlockGameAudio();
    if (onSpin()) setSpinRequested(true);
  };

  const handleChoose = (choice) => {
    if (choosing || !roundId) return;
    playChoose({ sound: soundRef.current });
    if (onChoose(roundId, choice)) setChoosing(true);
  };

  const peerName = peer?.name || 'them';
  const canSpin = !disabled && !spinning && !spinRequested && !awaitingChoice;

  // Nudge the asker when it's their turn to write.
  const askFxRoundRef = useRef(null);
  useEffect(() => {
    if (!writingQuestion || !iAmAsker || askFxRoundRef.current === roundId) return;
    askFxRoundRef.current = roundId;
    playChoose({ sound: soundRef.current });
  }, [writingQuestion, iAmAsker, roundId]);

  let status;
  if (spinRequested && !spinning) status = 'Spinning…';
  else if (!game) status = 'Spin it. Whoever the bottle points to picks Truth, Dare or Would you rather.';
  else if (spinning) status = game.spinnerId === myId ? 'Spinning…' : `${peerName} spun the bottle…`;
  else if (awaitingChoice) status = targetIsMe ? "It's you! Pick one." : `It landed on ${peerName}. They're picking…`;
  else if (writingQuestion) status = iAmAsker
    ? `${peerName} picked ${chosenMeta.label}. Write one, or tap a suggestion.`
    : `${peerName} is writing your ${chosenMeta.label.toLowerCase()}…`;
  else if (showQuestion) status = targetIsMe ? 'Your question is in the chat. Answer it below.' : `${peerName} is answering in the chat.`;

  return (
    <div className={`bg-stage${writingQuestion ? ' bg-stage--compact' : ''}`} role="dialog" aria-modal="true" aria-label="Truth & Dare">
      <div className="bg-stage__top">
        <span className="bg-stage__title">Truth &amp; Dare</span>
        <button type="button" className="bg-icon-btn" onClick={onClose} aria-label="Close game">
          <X size={18} />
        </button>
      </div>

      {writingQuestion ? (
        <span className={`bg-card__chip bg-card--${chosenMeta.tone} bg-stage__chip`}>
          <chosenMeta.Icon size={14} aria-hidden="true" />{chosenMeta.label}
          <span className="bg-feed-card__for">· for {iAmAsker ? peerName : 'you'}</span>
        </span>
      ) : (
      <div className="bg-table">
        <div className="bg-table__ring" aria-hidden="true" />
        <Seat position="top" name={peerName} photoUrl={peer?.photoUrl} isLanded={landed && !targetIsMe} />
        <div
          className={`bg-bottle${spinning ? ' bg-bottle--spinning' : ''}`}
          style={{
            transform: `rotate(${angle}deg)`,
            transitionDuration: `${spinMs}ms`
          }}
        >
          <Bottle />
        </div>
        <Seat position="bottom" name={me?.name} photoUrl={me?.photoUrl} isLanded={landed && targetIsMe} you />
      </div>
      )}

      <p className="bg-status" aria-live="polite">{status}</p>

      <div className="bg-actions">
        {awaitingChoice && targetIsMe && (
          <div className="bg-choices">
            {Object.entries(GAME_CHOICES).map(([key, meta], i) => (
              <button
                key={key}
                type="button"
                className={`bg-choice bg-choice--${meta.tone}`}
                style={{ animationDelay: `${i * 70}ms` }}
                disabled={choosing}
                onClick={() => handleChoose(key)}
              >
                <meta.Icon size={20} aria-hidden="true" />
                <span className="bg-choice__label">{meta.label}</span>
                <span className="bg-choice__hint">{meta.hint}</span>
              </button>
            ))}
          </div>
        )}

        {awaitingChoice && !targetIsMe && (
          <div className="bg-waiting" aria-hidden="true"><span /><span /><span /></div>
        )}

        {writingQuestion && iAmAsker && (
          <AskComposer
            key={roundId}
            tone={chosenMeta.tone}
            label={chosenMeta.label}
            suggestions={game.suggestions || []}
            onSend={(text, custom) => onAsk(roundId, text, custom)}
          />
        )}

        {writingQuestion && !iAmAsker && (
          <div className="bg-waiting" aria-hidden="true"><span /><span /><span /></div>
        )}

        {(!game || showQuestion) && !spinRequested && (
          <div className="bg-buttons">
            <button type="button" className="btn-primary bg-btn" onClick={handleSpin} disabled={!canSpin}>
              <RotateCw size={16} aria-hidden="true" />
              <span>{game ? 'Spin again' : 'Spin'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const MAX_QUESTION = 200;

/**
 * The asker writes the Truth / Dare / WYR: type your own, or tap a suggestion to drop it into
 * the box (and tweak it if you like), then send.
 */
function AskComposer({ tone, label, suggestions, onSend }) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  // A refused send (round expired, connection dropped) gets no event: let them try again.
  useEffect(() => {
    if (!sending) return undefined;
    const t = setTimeout(() => setSending(false), 3000);
    return () => clearTimeout(t);
  }, [sending]);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_QUESTION && !sending;

  const pick = (q, i) => {
    setPicked(i);
    setText(q);
    playChoose({ sound: false });
    inputRef.current?.focus();
  };

  const send = (e) => {
    e?.preventDefault();
    if (!canSend) return;
    const custom = picked === null || suggestions[picked] !== trimmed;
    if (onSend(trimmed, custom)) setSending(true);
  };

  return (
    <form className="bg-ask" onSubmit={send}>
      <label className="bg-ask__label" htmlFor="bg-ask-input">
        <PenLine size={14} aria-hidden="true" /> Your {label.toLowerCase()} for them
      </label>
      <div className={`bg-ask__box bg-card--${tone}`}>
        <textarea
          id="bg-ask-input"
          ref={inputRef}
          className="bg-ask__input"
          rows={2}
          maxLength={MAX_QUESTION}
          placeholder={`Type a ${label.toLowerCase()}…`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (picked !== null && e.target.value !== suggestions[picked]) setPicked(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) send(e);
          }}
        />
        <button type="submit" className="btn-primary bg-ask__send" disabled={!canSend} aria-label="Send question">
          <Send size={16} aria-hidden="true" />
        </button>
      </div>
      <span className="bg-ask__count" aria-live="polite">
        {text.length > MAX_QUESTION - 40 ? `${MAX_QUESTION - text.length} left` : ''}
      </span>

      {suggestions.length > 0 && (
        <>
          <span className="bg-ask__label">Or pick one</span>
          <ul className="bg-ask__suggestions">
            {suggestions.map((q, i) => (
              <li key={q}>
                <button
                  type="button"
                  className={`bg-ask__suggestion${picked === i ? ' bg-ask__suggestion--picked' : ''}`}
                  style={{ animationDelay: `${i * 50}ms` }}
                  aria-pressed={picked === i}
                  onClick={() => pick(q, i)}
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </form>
  );
}

/** The question as it stays in the chat feed after the round. */
export function GameFeedCard({ msg, myId, peerName }) {
  const meta = GAME_CHOICES[msg.choice] || GAME_CHOICES.TRUTH;
  const forMe = msg.targetId === myId;
  return (
    <div className={`bg-feed-card bg-card--${meta.tone}`}>
      <span className="bg-card__chip">
        <meta.Icon size={13} aria-hidden="true" />{meta.label}
        <span className="bg-feed-card__for">
          · {forMe ? 'for you' : `for ${peerName}`}
          {msg.askerId ? (msg.askerId === myId ? ' · you asked' : ` · from ${peerName}`) : ''}
        </span>
      </span>
      <p className="bg-feed-card__question">{msg.question}</p>
    </div>
  );
}
