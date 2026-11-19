import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a message takes to fade out before it is removed from the feed. */
export const VANISH_MS = 380;

/**
 * "Disappear after seen" messages are only marked seen after they have been on screen this long,
 * so the reader gets to read them before they go.
 */
export const AFTER_SEEN_READ_MS = 2500;

/**
 * Disappearing messages leave with an animation instead of popping out.
 *
 * `vanish(ids, onGone)` marks the messages as leaving (the feed adds `is-vanishing`, which plays
 * the fade-out), then calls `onGone(ids)` once the animation has finished so the caller can drop
 * them from its list. Ids already leaving are not started twice.
 */
export function useVanish() {
  const [leaving, setLeaving] = useState(() => new Set());
  const leavingRef = useRef(new Set());
  const timers = useRef(new Set());

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);

  const vanish = useCallback((ids, onGone) => {
    const fresh = [...new Set(ids)].filter(id => id && !leavingRef.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach(id => leavingRef.current.add(id));
    setLeaving(new Set(leavingRef.current));

    const timer = setTimeout(() => {
      timers.current.delete(timer);
      fresh.forEach(id => leavingRef.current.delete(id));
      setLeaving(new Set(leavingRef.current));
      onGone?.(fresh);
    }, VANISH_MS);
    timers.current.add(timer);
  }, []);

  return { leaving, vanish };
}
