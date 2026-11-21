import { useEffect, useRef } from 'react';

/*
 * One stack of Back handlers for the whole app. Each active handler owns one extra browser history
 * entry; Back pops the entry and runs the newest handler (an open DM before the tab history, the
 * tab history before the exit prompt).
 *
 * Chrome's Back button skips history entries a page added before the user interacted with it, so
 * entries are only added once the page has had a tap or key press; until then they wait for one.
 */
const stack = [];
const waiting = [];
let ignorePops = 0;
let listening = false;

const hasInteracted = () => navigator.userActivation?.hasBeenActive ?? true;

function push(entry) {
  entry.popped = false;
  window.history.pushState({ ...(window.history.state || {}), rmBack: entry.id }, '');
  stack.push(entry);
}

function arm(entry) {
  // Pushing while our own history.back() is still on its way would let that back() undo the new
  // entry, so wait for it to land (see onPop); also wait for the first tap (see above).
  if (hasInteracted() && ignorePops === 0) push(entry);
  else if (!waiting.includes(entry)) waiting.push(entry);
}

function flushWaiting() {
  if (!hasInteracted() || ignorePops > 0) return;
  waiting.splice(0).forEach(push);
}

function onPop() {
  // Our own history.back() after a handler was closed from the UI
  if (ignorePops > 0) {
    ignorePops -= 1;
    flushWaiting();
    return;
  }
  const top = stack.pop();
  if (!top) return;
  top.popped = true;
  // A handler that returns true stays armed (e.g. there are more tabs to go back to)
  if (top.run()) arm(top);
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener('popstate', onPop);
  ['pointerdown', 'keydown', 'touchend'].forEach(t => window.addEventListener(t, flushWaiting, true));
}

/**
 * Leaves the site for real: drops every Back entry this app added and goes to the page before it.
 * (A tab that was opened straight onto the site has no page before it; Back then closes it.)
 */
export function exitApp() {
  const extra = stack.length;
  stack.splice(0).forEach(e => { e.popped = true; });
  waiting.length = 0;
  // Opened straight onto the site: there is no page before it, so stop at its first entry.
  const steps = Math.min(extra + 1, window.history.length - 1);
  if (steps > 0) window.history.go(-steps);
}

/**
 * While `active`, the hardware/browser Back button calls `onBack` instead of leaving the app, the
 * way a pushed screen behaves in a native app. If `onBack` returns true it keeps catching Back.
 *
 * Closing the screen from the UI (active -> false) pops the extra history entry so the stack stays
 * balanced.
 */
export function useBackHandler(active, onBack) {
  const cbRef = useRef(onBack);
  cbRef.current = onBack;

  useEffect(() => {
    if (!active) return undefined;
    const entry = {
      id: `rm-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      run: () => cbRef.current?.() === true,
      popped: false
    };

    // Deferred so React StrictMode's mount→unmount→mount does not push twice.
    const timer = setTimeout(() => {
      listen();
      arm(entry);
    }, 0);

    return () => {
      clearTimeout(timer);
      const w = waiting.indexOf(entry);
      if (w !== -1) waiting.splice(w, 1);
      const i = stack.indexOf(entry);
      if (i === -1 || entry.popped) return;
      stack.splice(i, 1);
      ignorePops += 1;
      window.history.back();
    };
  }, [active]);
}
