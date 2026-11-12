import { useEffect, useRef } from 'react';

/**
 * While `active`, the hardware/browser Back button calls `onBack` instead of
 * leaving the app — the way a pushed screen behaves in a native app.
 *
 * Closing the screen from the UI (active -> false) pops the extra history entry
 * so the stack stays balanced.
 */
export function useBackHandler(active, onBack) {
  const cbRef = useRef(onBack);
  cbRef.current = onBack;

  useEffect(() => {
    if (!active) return undefined;
    const id = `rm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let pushed = false;
    let popped = false;

    const onPop = () => {
      if (!pushed || popped) return;
      popped = true;
      cbRef.current?.();
    };

    // Deferred so React StrictMode's mount→unmount→mount does not push twice.
    const timer = setTimeout(() => {
      window.history.pushState({ ...(window.history.state || {}), rmBack: id }, '');
      pushed = true;
      window.addEventListener('popstate', onPop);
    }, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('popstate', onPop);
      if (pushed && !popped && window.history.state?.rmBack === id) {
        window.history.back();
      }
    };
  }, [active]);
}
