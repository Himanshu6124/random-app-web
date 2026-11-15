/**
 * Radar sound effects for the Match search, synthesised with Web Audio (no files).
 *
 *  - startRadarSounds(sweepSeconds, blipAngles): a soft sonar ping each time the
 *    sweep starts a turn, plus a faint tick as it crosses each blip. Scheduled on the
 *    audio clock so it stays in step with the CSS sweep. Returns a stop function.
 *  - playLockOn(): two quick lock beeps, then a warm rising chord and a sparkle as
 *    the matched avatar lands next to yours.
 *
 * Browsers only allow audio after a user gesture, so call unlockRadarAudio() from
 * the "Find a Match" tap.
 */

let ctx = null;
let master = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function unlockRadarAudio() {
  try { getCtx(); } catch { /* audio unavailable */ }
}

// A private gain stage per sound group, so stopping it silences tones that were
// already scheduled ahead on the audio clock (not just future scheduling).
function createBus(c) {
  const bus = c.createGain();
  bus.gain.value = 1;
  bus.connect(master);
  let done = false;
  const stop = () => {
    if (done) return;
    done = true;
    const now = c.currentTime;
    try {
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(0, now + 0.04);
    } catch { /* ignore */ }
    setTimeout(() => { try { bus.disconnect(); } catch { /* ignore */ } }, 80);
  };
  return { node: bus, stop };
}

// One enveloped tone. `to` glides the pitch; `echo` adds a couple of quieter repeats.
function tone(c, at, { freq, to, type = 'sine', gain = 0.1, attack = 0.005, decay = 0.4, echo = 0 }, out = master) {
  const repeats = [[0, 1], ...(echo ? [[0.18, 0.35], [0.36, 0.14]] : [])];
  for (const [delay, level] of repeats) {
    const t = at + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + decay * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain * level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }
}

export function startRadarSounds(sweepSeconds, blipAngles = []) {
  let c;
  try { c = getCtx(); } catch { return () => {}; }
  if (!c) return () => {};

  const bus = createBus(c);
  const start = c.currentTime + 0.02;
  let nextTurn = 0;
  let stopped = false;

  // Schedule whole sweeps a little ahead of time; check every half second.
  const schedule = () => {
    if (stopped) return;
    while (start + nextTurn * sweepSeconds < c.currentTime + 1.5) {
      const t0 = start + nextTurn * sweepSeconds;
      if (t0 >= c.currentTime) {
        tone(c, t0, { freq: 1180, to: 980, gain: 0.07, attack: 0.008, decay: 0.55, echo: 1 }, bus.node);
      }
      for (const angle of blipAngles) {
        const t = t0 + (angle / 360) * sweepSeconds;
        if (t >= c.currentTime) tone(c, t, { freq: 1760, type: 'triangle', gain: 0.018, decay: 0.09 }, bus.node);
      }
      nextTurn += 1;
    }
  };
  schedule();
  const timer = setInterval(schedule, 500);

  return () => {
    stopped = true;
    clearInterval(timer);
    bus.stop();
  };
}

// Short by design: it must finish by the time the chat slides in (~1.15s).
// Returns a stop function that cuts it off immediately.
export function playLockOn() {
  let c;
  try { c = getCtx(); } catch { return () => {}; }
  if (!c) return () => {};
  const bus = createBus(c);
  const out = bus.node;
  const t = c.currentTime + 0.02;

  // Crosshair lock: two crisp beeps
  tone(c, t, { freq: 1320, type: 'square', gain: 0.035, decay: 0.07 }, out);
  tone(c, t + 0.08, { freq: 1760, type: 'square', gain: 0.035, decay: 0.09 }, out);

  // Sparkle with the heart burst
  [2093, 2637, 3136].forEach((f, i) => {
    tone(c, t + 0.14 + i * 0.05, { freq: f, type: 'sine', gain: 0.025, decay: 0.2 }, out);
  });

  // Avatar glides in: soft rising whoosh
  tone(c, t + 0.2, { freq: 330, to: 660, type: 'sine', gain: 0.05, attack: 0.15, decay: 0.4 }, out);

  // Lands next to you: warm C-major arpeggio (C5 E5 G5 C6)
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(c, t + 0.45 + i * 0.06, { freq: f, type: 'sine', gain: 0.09, attack: 0.01, decay: 0.5 }, out);
    tone(c, t + 0.45 + i * 0.06, { freq: f * 2, type: 'triangle', gain: 0.015, decay: 0.3 }, out);
  });

  return bus.stop;
}
