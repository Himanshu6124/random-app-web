import { useEffect, useRef } from 'react';

const EDGE = 28;        // px from the left edge where the gesture may start
const TRIGGER = 0.28;   // fraction of the width that commits the "back"

/**
 * iOS-style interactive swipe-from-left-edge to go back.
 * The element follows the finger and slides out if released past the threshold.
 */
export function useEdgeSwipeBack(ref, enabled, onBack) {
  const cbRef = useRef(onBack);
  cbRef.current = onBack;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return undefined;

    let startX = 0;
    let startY = 0;
    let dx = 0;
    let tracking = false;
    let locked = false;

    const reset = (animate) => {
      el.style.transition = animate ? 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)' : '';
      el.style.transform = '';
    };

    const onStart = (e) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || t.clientX > EDGE) return;
      tracking = true;
      locked = false;
      startX = t.clientX;
      startY = t.clientY;
      dx = 0;
      el.style.transition = 'none';
    };

    const onMove = (e) => {
      if (!tracking) return;
      const t = e.touches[0];
      const mx = t.clientX - startX;
      const my = t.clientY - startY;
      if (!locked) {
        if (Math.abs(my) > Math.abs(mx) && Math.abs(my) > 8) { tracking = false; reset(false); return; }
        if (mx > 8) locked = true;
      }
      if (locked) {
        dx = Math.max(0, mx);
        el.style.transform = `translate3d(${dx}px,0,0)`;
        if (e.cancelable) e.preventDefault();
      }
    };

    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (locked && dx > el.offsetWidth * TRIGGER) {
        el.style.transition = 'transform 0.2s ease-out';
        el.style.transform = 'translate3d(100%,0,0)';
        setTimeout(() => {
          cbRef.current?.();
          reset(false);
        }, 190);
      } else {
        reset(true);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      reset(false);
    };
  }, [ref, enabled]);
}
