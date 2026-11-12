/**
 * Native-app shell helpers for mobile web.
 *
 * - Keeps `--app-height` equal to the *visible* viewport so the layout shrinks
 *   above the on-screen keyboard (iOS Safari does not resize the layout viewport).
 * - Flags standalone (installed PWA) mode and touch devices on <html>.
 * - Blocks pinch / double-tap zoom so the UI behaves like a native screen.
 */
export function initNativeShell() {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) root.classList.add('is-standalone');
  if (window.matchMedia?.('(hover: none) and (pointer: coarse)').matches) root.classList.add('is-touch');

  const vv = window.visualViewport;
  let raf = 0;
  const sync = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const keyboardOpen = vv ? window.innerHeight - vv.height > 120 : false;
      root.classList.toggle('keyboard-open', keyboardOpen);
      // Only pin the height while the keyboard is up. Otherwise let CSS (100dvh)
      // fill the screen: in an installed iOS app visualViewport.height can omit
      // the status-bar area, which left a gap under the tab bar.
      if (keyboardOpen) root.style.setProperty('--app-height', `${Math.round(vv.height)}px`);
      else root.style.removeProperty('--app-height');
      // iOS scrolls the whole page to reveal a focused input; pin it back.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    });
  };
  sync();
  (vv || window).addEventListener('resize', sync);
  vv?.addEventListener('scroll', sync);
  window.addEventListener('orientationchange', sync);

  // Service worker (pass-through, no caching) — required for the install prompt.
  if ('serviceWorker' in navigator && window.isSecureContext) {
    const register = () =>
      navigator.serviceWorker.register('/sw.js').catch(() => { /* install just won't be offered */ });
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }

  // iOS ignores user-scalable=no; block pinch-zoom gestures explicitly.
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
}

/** Light haptic tick on devices that support it (Android Chrome). */
export function haptic(ms = 8) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    /* not supported */
  }
}
