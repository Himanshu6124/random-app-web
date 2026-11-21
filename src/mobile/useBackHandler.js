import { useEffect, useRef } from 'react';

/*
 * One stack of Back handlers for the whole app. Each active handler owns one extra browser history
 * entry; Back pops the entry and runs the newest handler (an open DM before the tab history, the
 * tab history before the "leave random chat?" guard).
 */
const stack = [];
let ignorePops = 0;
let listening = false;

function arm(entry) {
  entry.popped = false;
  window.history.pushState({ ...(window.history.state || {}), rmBack: entry.id }, '');
  stack.push(entry);
}

function onPop() {
  // Our own history.back() after a handler was closed from the UI
  if (ignorePops > 0) {
    ignorePops -= 1;
    return;
  }
  const top = stack.pop();
  if (!top) return;
  top.popped = true;
  // A handler that returns true stays armed (e.g. there are more tabs to go back to)
  if (top.run()) arm(top);
}

/**
 * While `active`, the hardware/browser Back button calls `onBack` instead of leaving the app, the
 * way a pushed screen behaves in a native app. If `onBack` returns true it keeps catching Back.
 * Changing `key` re-arms a handler that already fired.
 *
 * Closing the screen from the UI (active -> false) pops the extra history entry so the stack stays
 * balanced.
 */
export function useBackHandler(active, onBack, key) {
  const cbRef = useRef(onBack);
  cbRef.current = onBack;

  useEffect(() => {
    if (!active) return undefined;
    const entry = {
      id: `rm-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      run: () => cbRef.current?.() === true,
      popped: false
    };
    let armed = false;

    // Deferred so React StrictMode's mount→unmount→mount does not push twice.
    const timer = setTimeout(() => {
      if (!listening) {
        window.addEventListener('popstate', onPop);
        listening = true;
      }
      arm(entry);
      armed = true;
    }, 0);

    return () => {
      clearTimeout(timer);
      if (!armed || entry.popped) return;
      const i = stack.indexOf(entry);
      if (i !== -1) stack.splice(i, 1);
      ignorePops += 1;
      window.history.back();
    };
  }, [active, key]);
}
