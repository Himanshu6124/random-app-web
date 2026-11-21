import { useCallback, useEffect, useRef, useState } from 'react';
import { useBackHandler, exitApp } from './useBackHandler';

/**
 * Back button and closing the site, app-wide:
 * - Back returns to the tab you came from (match → friends → profile, Back → friends → match).
 * - With nowhere left to go back to, Back always asks before leaving the site (and ends the
 *   random chat if one is going). During a random chat, closing / reloading the page shows the
 *   browser's own "Leave site?" prompt too.
 */
export function useAppBackNavigation({ enabled, activeTab, setActiveTab, inRandomChat, endRandomChat }) {
  const [trail, setTrail] = useState([]);
  const trailRef = useRef(trail);
  trailRef.current = trail;
  const prevTabRef = useRef(activeTab);
  const fromBackRef = useRef(false);

  // Record tab changes made in the UI; a tab you go back to drops everything after it.
  useEffect(() => {
    const prev = prevTabRef.current;
    prevTabRef.current = activeTab;
    if (prev === activeTab) return;
    if (fromBackRef.current) {
      fromBackRef.current = false;
      return;
    }
    setTrail(t => {
      const i = t.indexOf(activeTab);
      return i !== -1 ? t.slice(0, i) : [...t, prev];
    });
  }, [activeTab]);

  useEffect(() => { if (!enabled) setTrail([]); }, [enabled]);

  useBackHandler(enabled && trail.length > 0, () => {
    const t = trailRef.current;
    const target = t[t.length - 1];
    fromBackRef.current = true;
    setTrail(t.slice(0, -1));
    setActiveTab(target);
    return t.length > 1;
  });

  // Nothing left to go back to: ask before leaving the site.
  const [leaveOpen, setLeaveOpen] = useState(false);
  useBackHandler(enabled && trail.length === 0, () => {
    setLeaveOpen(true);
    return true;
  });

  // Set once the user confirmed leaving, so the browser does not ask a second time.
  const exitingRef = useRef(false);
  useEffect(() => {
    if (!enabled || !inRandomChat) return undefined;
    const onBeforeUnload = (e) => {
      if (exitingRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [enabled, inRandomChat]);

  const stay = useCallback(() => setLeaveOpen(false), []);
  const leave = useCallback(() => {
    setLeaveOpen(false);
    exitingRef.current = true;
    if (inRandomChat) endRandomChat();
    exitApp();
    // Still here (no page to go back to): ask again next time.
    setTimeout(() => { exitingRef.current = false; }, 1500);
  }, [inRandomChat, endRandomChat]);

  return { leaveOpen, stay, leave };
}
