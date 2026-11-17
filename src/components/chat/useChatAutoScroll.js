import { useEffect, useLayoutEffect, useRef } from 'react';

const NEAR_BOTTOM_PX = 120;
const FOLLOW_MS = 360;

/**
 * Keeps a chat feed at the latest message.
 *  - Opening a chat (or a history batch arriving) jumps straight to the bottom, no scroll
 *    animation from the top.
 *  - A new live message glides into view, but only if you were already at the bottom (or
 *    sent it yourself), so reading older messages is never interrupted.
 *  - Height changes at the bottom (typing row folding, images finishing loading) keep the
 *    feed pinned while you are at the bottom.
 *
 * `threadKey` identifies the open chat (and whether it is visible); `pulse` is any value
 * that changes when the bottom of the feed grows or shrinks (typing, game cards…).
 */
export function useChatAutoScroll(feedRef, { threadKey, lastId, count, lastIsMine, pulse }) {
  const pinned = useRef(true);
  const needsJump = useRef(true);
  const prevCount = useRef(0);
  const followUntil = useRef(0);
  const raf = useRef(0);

  const toBottom = (smooth) => {
    const el = feedRef.current;
    if (!el) return;
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    else el.scrollTop = el.scrollHeight;
  };

  // Follow the bottom for a short while, frame by frame, while something animates there.
  const follow = (ms = FOLLOW_MS) => {
    followUntil.current = Math.max(followUntil.current, performance.now() + ms);
    if (raf.current) return;
    const step = () => {
      if (pinned.current) toBottom(false);
      if (performance.now() < followUntil.current) raf.current = requestAnimationFrame(step);
      else raf.current = 0;
    };
    raf.current = requestAnimationFrame(step);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Track whether the reader is at the bottom.
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    };
    // Images load after first paint and push the feed taller; stay at the bottom.
    const onLoad = (e) => {
      if (e.target?.tagName === 'IMG' && pinned.current) toBottom(false);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('load', onLoad, true);
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('load', onLoad, true);
    };
  }, [feedRef, threadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // A different chat: next layout lands on the last message.
  useLayoutEffect(() => {
    needsJump.current = true;
    pinned.current = true;
    prevCount.current = 0;
  }, [threadKey]);

  useLayoutEffect(() => {
    const added = count - prevCount.current;
    prevCount.current = count;
    if (count === 0) return;
    if (needsJump.current || added > 2 || added < 0) {
      // First paint of a chat, or a history batch: no animation.
      needsJump.current = false;
      pinned.current = true;
      toBottom(false);
      follow(600);
      return;
    }
    if (added > 0 && (pinned.current || lastIsMine)) {
      pinned.current = true;
      toBottom(true);
    }
  }, [threadKey, lastId, count]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (pinned.current) follow();
  }, [pulse]); // eslint-disable-line react-hooks/exhaustive-deps
}
