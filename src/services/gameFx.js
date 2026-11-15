/**
 * Truth & Dare sound + haptics. Sounds are synthesized with Web Audio (no files to load),
 * haptics go through the shared haptic() helper (Vibration API on Android, switch tick on iOS).
 */
import { haptic } from '../mobile/nativeShell';

let ctx = null;

function audio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a tap handler so the browser lets us play sound later (peer's spin, landing). */
export function unlockGameAudio() {
  audio();
}

function tone(c, { at, freq, to, type = 'sine', dur = 0.12, vol = 0.12 }) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
  return osc;
}

export function vibrate(pattern) {
  haptic(pattern);
}

/**
 * Tick times (ms) while the bottle decelerates, roughly matching the CSS ease-out curve:
 * dense at the start, spreading out as it settles.
 */
function tickTimes(durationMs, count) {
  const times = [];
  for (let i = 1; i <= count; i += 1) {
    const p = i / (count + 1);
    times.push(Math.round(durationMs * (1 - Math.cbrt(1 - p))));
  }
  return times;
}

/** Whoosh + ticks + haptic rattle for one spin. Returns a stop() for unmount. */
export function playSpin(durationMs, { sound = true, haptics = true } = {}) {
  const ticks = tickTimes(durationMs, 22);
  const oscs = [];
  const c = sound ? audio() : null;

  if (c) {
    const t0 = c.currentTime + 0.02;
    oscs.push(tone(c, { at: t0, freq: 180, to: 520, type: 'sawtooth', dur: 0.35, vol: 0.05 }));
    ticks.forEach((ms, i) => {
      oscs.push(tone(c, {
        at: t0 + ms / 1000,
        freq: 1300 - i * 25,
        type: 'square',
        dur: 0.035,
        vol: 0.05
      }));
    });
  }

  if (haptics) {
    // [buzz, pause, buzz, pause, ...] following the same tick spacing
    const pattern = [20];
    let last = 20;
    ticks.forEach((ms) => {
      const gap = Math.max(ms - last, 10);
      pattern.push(gap, 8);
      last = ms + 8;
    });
    vibrate(pattern);
  }

  return () => {
    oscs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
    if (haptics) vibrate(0);
  };
}

/** The bottle settles on someone. Louder for you. */
export function playLand(isMe, { sound = true } = {}) {
  vibrate(isMe ? [60, 50, 90] : 40);
  const c = sound ? audio() : null;
  if (!c) return;
  const t = c.currentTime + 0.01;
  tone(c, { at: t, freq: 140, to: 70, type: 'sine', dur: 0.18, vol: 0.22 });
  const notes = isMe ? [659.25, 830.61, 987.77] : [523.25, 659.25];
  notes.forEach((f, i) => tone(c, { at: t + 0.08 + i * 0.09, freq: f, type: 'triangle', dur: 0.22, vol: 0.12 }));
}

/** Tapping Truth / Dare / Would you rather. */
export function playChoose({ sound = true } = {}) {
  vibrate(25);
  const c = sound ? audio() : null;
  if (!c) return;
  tone(c, { at: c.currentTime + 0.01, freq: 600, to: 900, type: 'triangle', dur: 0.09, vol: 0.12 });
}

/** The question card lands in the chat. */
export function playReveal({ sound = true } = {}) {
  vibrate([30, 40, 30]);
  const c = sound ? audio() : null;
  if (!c) return;
  const t = c.currentTime + 0.01;
  [783.99, 1046.5, 1318.5].forEach((f, i) => (
    tone(c, { at: t + i * 0.07, freq: f, type: 'sine', dur: 0.3, vol: 0.09 })
  ));
}
