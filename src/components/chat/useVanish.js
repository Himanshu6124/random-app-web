import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a message takes to dissolve before it is removed from the feed (see .is-vanishing). */
export const VANISH_MS = 700;

/**
 * "Disappear after seen": once the other person has seen a message it stays this long, so both
 * people can still read it, then it dissolves. The server uses the same grace period.
 */
export const AFTER_SEEN_GRACE_MS = 5000;

/** An unopened view-once photo is not "read" by a seen receipt: it waits until it is opened. */
const waitsForOpen = (m) => m.viewOnce && !m.viewedAt;

/**
 * Starts the after-seen countdown: every "disappear after seen" message up to and including
 * `upToId` that `isTarget` picks gets an `expiresAt` {@link AFTER_SEEN_GRACE_MS} from now (an
 * earlier expiry is kept). The feeds' expiry tickers then make them vanish on time.
 * Returns the same array when nothing changed.
 */
export function startAfterSeenCountdown(list, upToId, isTarget) {
  if (!Array.isArray(list) || !upToId) return list;
  const idx = list.findIndex(m => m.id === upToId);
  if (idx === -1) return list;
  const goneAt = Date.now() + AFTER_SEEN_GRACE_MS;
  let changed = false;
  const next = list.map((m, i) => {
    if (i > idx || !m.disappearOnSeen || !isTarget(m) || waitsForOpen(m)) return m;
    if (m.expiresAt && Date.parse(m.expiresAt) <= goneAt) return m;
    changed = true;
    return { ...m, expiresAt: new Date(goneAt).toISOString() };
  });
  return changed ? next : list;
}

/**
 * A view-once photo was opened: it stays in the chat as "Opened" (the photo itself is gone).
 * In an "after seen" chat the Opened marker then follows the usual countdown.
 */
export function markViewOnceOpened(list, messageId, viewedAt) {
  if (!Array.isArray(list) || !messageId) return list;
  let changed = false;
  const next = list.map(m => {
    if (m.id !== messageId || m.viewedAt) return m;
    changed = true;
    const opened = { ...m, viewedAt: viewedAt || new Date().toISOString(), objectUri: null, localPreviewUrl: null };
    if (m.disappearOnSeen && !m.expiresAt) {
      opened.expiresAt = new Date(Date.now() + AFTER_SEEN_GRACE_MS).toISOString();
    }
    return opened;
  });
  return changed ? next : list;
}

/**
 * Disappearing messages leave with an animation instead of popping out.
 *
 * `vanish(ids, onGone)` marks the messages as leaving (the feed adds `is-vanishing`, which plays
 * the dissolve), then calls `onGone(ids)` once the animation has finished so the caller can drop
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

/** True when a timed disappearing message's time is up (ISO string or epoch ms). */
const isDue = (m, now) => {
  if (!m?.expiresAt) return false;
  const at = typeof m.expiresAt === 'number' ? m.expiresAt : Date.parse(m.expiresAt);
  return Number.isFinite(at) && at <= now;
};

/**
 * Disappearing messages of one chat feed, shared by random chats and friend DMs.
 * `getList()` returns the feed's current messages, `remove(ids)` drops them from it. Every second
 * the expired ones dissolve (see {@link useVanish}); `vanish(ids)` does the same on demand.
 */
export function useDisappearingFeed(getList, remove) {
  const { leaving, vanish: vanishRaw } = useVanish();
  const src = useRef({ getList, remove });
  src.current = { getList, remove };
  const vanish = useCallback((ids) => vanishRaw(ids, (gone) => src.current.remove(gone)), [vanishRaw]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const due = (src.current.getList() || []).filter(m => isDue(m, now)).map(m => m.id);
      if (due.length) vanish(due);
    }, 1000);
    return () => clearInterval(id);
  }, [vanish]);

  return { leaving, vanish };
}
