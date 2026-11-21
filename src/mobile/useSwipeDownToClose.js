import { useCallback, useRef } from 'react';

const CLOSE_DISTANCE_PX = 110;
const CLOSE_VELOCITY = 0.6; // px per ms

/**
 * Bottom-sheet "drag down to dismiss" for touch screens. Spread the returned handlers on the
 * sheet element. A drag only starts when the sheet is scrolled to the top and the touch did not
 * begin in a text field; the sheet follows the finger and either slides away (far or fast
 * enough) and calls onClose, or springs back.
 */
export function useSwipeDownToClose(onClose) {
  const drag = useRef(null);

  const setOffset = (el, y, animate) => {
    el.style.transition = animate ? 'transform 0.22s cubic-bezier(.2,.8,.2,1)' : 'none';
    el.style.transform = y ? `translateY(${y}px)` : '';
  };

  const onTouchStart = useCallback((e) => {
    const el = e.currentTarget;
    if (e.touches.length !== 1 || el.scrollTop > 0) return;
    if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    drag.current = { startY: e.touches[0].clientY, startX: e.touches[0].clientX, t: Date.now(), dy: 0, active: false };
  }, []);

  const onTouchMove = useCallback((e) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.touches[0].clientY - d.startY;
    const dx = e.touches[0].clientX - d.startX;
    if (!d.active) {
      // Only a mostly-vertical downward pull becomes a drag; anything else is left alone.
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) { drag.current = null; return; }
      d.active = true;
    }
    d.dy = Math.max(0, dy);
    setOffset(e.currentTarget, d.dy, false);
  }, []);

  const onTouchEnd = useCallback((e) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    const el = e.currentTarget;
    const velocity = d.dy / Math.max(1, Date.now() - d.t);
    if (d.dy > CLOSE_DISTANCE_PX || velocity > CLOSE_VELOCITY) {
      setOffset(el, el.offsetHeight + 40, true);
      setTimeout(onClose, 200);
    } else {
      setOffset(el, 0, true);
    }
  }, [onClose]);

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd };
}
