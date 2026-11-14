import { useRef } from 'react';

/**
 * Returns the set of message ids that arrived while this thread was open,
 * so only those animate in. History loaded on open (or a big batch) never pops.
 * `threadKey` resets the baseline when the user switches conversation.
 */
export function useNewMessageIds(messages, threadKey) {
  const state = useRef({ key: undefined, seen: new Set(), fresh: new Set() });
  const s = state.current;

  if (s.key !== threadKey) {
    s.key = threadKey;
    s.seen = new Set(messages.map(m => m.id));
    s.fresh = new Set();
    return s.fresh;
  }

  const added = messages.filter(m => !s.seen.has(m.id));
  // A history page arrives as a batch; live messages arrive one or two at a time.
  if (added.length > 0 && added.length <= 2) added.forEach(m => s.fresh.add(m.id));
  added.forEach(m => s.seen.add(m.id));
  return s.fresh;
}

/** "05:59 PM" → "5:59 PM" (server strings arrive pre-formatted) */
export function displayTime(t) {
  return typeof t === 'string' ? t.replace(/^0(\d:)/, '$1') : t;
}
