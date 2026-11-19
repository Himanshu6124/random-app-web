import React, { useEffect, useRef } from 'react';

const SPEED_PX_PER_S = 9;     // very slow drift, just enough to show it scrolls
const RESUME_AFTER_MS = 3500; // after the user lets go, wait this long before drifting again
const EDGE_PAUSE_MS = 1400;   // rest at each end before turning around

/**
 * Three rows of vibe chips that scroll sideways together. The user can swipe / scroll it like
 * any list and tap a chip; on its own it drifts very slowly back and forth so it is obvious
 * there is more to see. Any touch, wheel or drag pauses the drift.
 */
export function VibeScroller({ children }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    // Touch screens (iOS included) already swipe this natively. Writing scrollLeft every frame
    // there fights the system's momentum scroll and makes the chips jitter, so no drift on them.
    if (window.matchMedia?.('(hover: none) and (pointer: coarse)').matches) return undefined;

    let pos = el.scrollLeft;
    let dir = 1;
    let last = 0;
    let pausedUntil = performance.now() + 1200; // let the screen settle first
    let raf = 0;

    const pause = (ms = RESUME_AFTER_MS) => { pausedUntil = performance.now() + ms; };

    const step = (now) => {
      raf = requestAnimationFrame(step);
      const dt = last ? Math.min(64, now - last) : 0;
      last = now;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 1 || now < pausedUntil || document.hidden) {
        pos = el.scrollLeft;
        return;
      }
      pos += dir * SPEED_PX_PER_S * (dt / 1000);
      if (pos >= max) { pos = max; dir = -1; pause(EDGE_PAUSE_MS); }
      if (pos <= 0) { pos = 0; dir = 1; pause(EDGE_PAUSE_MS); }
      el.scrollLeft = pos;
    };
    raf = requestAnimationFrame(step);

    // Our own scrollLeft writes land within a pixel of `pos`; anything else is the user.
    const onScroll = () => {
      if (Math.abs(el.scrollLeft - pos) > 2) {
        pos = el.scrollLeft;
        pause();
      }
    };
    const onUser = () => pause();
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('pointerdown', onUser, { passive: true });
    el.addEventListener('touchstart', onUser, { passive: true });
    el.addEventListener('wheel', onUser, { passive: true });
    el.addEventListener('focusin', onUser);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('pointerdown', onUser);
      el.removeEventListener('touchstart', onUser);
      el.removeEventListener('wheel', onUser);
      el.removeEventListener('focusin', onUser);
    };
  }, []);

  // Deal the chips into three rows (1st, 4th, 7th… on the first row) that scroll as one.
  const items = React.Children.toArray(children);
  const rows = [0, 1, 2].map(r => items.filter((_, i) => i % 3 === r));

  return (
    <div ref={ref} className="vibe-scroller">
      <div className="vibe-scroller__rows">
        {rows.map((row, r) => <div key={r} className="vibe-scroller__row">{row}</div>)}
      </div>
    </div>
  );
}
