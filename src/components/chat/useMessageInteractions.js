import { useCallback, useEffect, useState } from 'react';

/**
 * Which message currently shows its action bar / emoji picker. Only one at a time, and a tap
 * anywhere outside a message's controls closes it.
 */
export function useMessageInteractions() {
  const [activeId, setActiveId] = useState(null);
  const [pickerId, setPickerId] = useState(null);

  const close = useCallback(() => {
    setActiveId(null);
    setPickerId(null);
  }, []);

  useEffect(() => {
    if (!activeId && !pickerId) return undefined;
    const onPointerDown = (e) => {
      if (e.target.closest?.('[data-msg-interactive]')) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [activeId, pickerId, close]);

  return { activeId, setActiveId, pickerId, setPickerId, close };
}
