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

      // iOS 26 home-screen apps: the web view only paints `innerHeight` points
      // (screen height minus the status bar) while 100% / 100vh still resolve to
      // the full screen, so the bottom ~60pt — the tab bar — got clipped. Size the
      // shell to what is actually visible and drop the home-indicator padding that
      // the lost strip already covers.
      const portrait = window.matchMedia?.('(orientation: portrait)').matches ?? true;
      const screenH = portrait
        ? Math.max(window.screen.width, window.screen.height)
        : Math.min(window.screen.width, window.screen.height);
      const lost = isStandalone && !keyboardOpen ? Math.round(screenH - window.innerHeight) : 0;
      root.classList.toggle('viewport-short', lost > 1);
      if (lost > 1) {
        root.style.setProperty('--standalone-height', `${window.innerHeight}px`);
        root.style.setProperty('--viewport-lost', `${lost}px`);
      } else {
        root.style.removeProperty('--standalone-height');
        root.style.removeProperty('--viewport-lost');
      }
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

export const isIOS = typeof navigator !== 'undefined' && (
  /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

let iosTimers = [];
let lastIosTapHaptic = 0;

/**
 * Called when the user's tap toggles an <IosHaptic> switch (which already
 * ticked), so the scripted tick for the same tap is skipped. Avoids a double
 * tick on iOS versions where scripted ticks still work.
 */
export function markIosTapHaptic() {
  lastIosTapHaptic = Date.now();
}

/**
 * iOS Safari has no Vibration API. On iOS 18+, toggling an
 * `<input type="checkbox" switch>` plays the system haptic tick, so we click
 * the label of a throwaway switch. The switch must be *rendered* (WebKit skips
 * the haptic for a `display:none` control), so it is laid out off-screen and
 * invisible instead, and a fresh one is used per tick. Ticks fire reliably
 * inside a user gesture; delayed ones (patterns) are best effort.
 */
function iosTick() {
  try {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    label.click();
    label.remove();
  } catch {
    /* not supported */
  }
}

/**
 * Haptic feedback on Android (Vibration API) and iOS 17.4+ (switch-toggle tick).
 * `pattern` is ms or a [buzz, pause, buzz, ...] array, like navigator.vibrate;
 * 0 cancels. On iOS every buzz becomes one tick (duration can't be controlled).
 */
export function haptic(pattern = 8) {
  try {
    // iOS first: some iOS browsers expose a no-op navigator.vibrate, which
    // would otherwise swallow the call before the switch fallback runs.
    if (!isIOS) {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
      return;
    }
    iosTimers.forEach(clearTimeout);
    iosTimers = [];
    const steps = Array.isArray(pattern) ? pattern : [pattern];
    let at = 0;
    steps.forEach((ms, i) => {
      if (i % 2 === 0 && ms > 0) {
        if (at === 0) {
          if (Date.now() - lastIosTapHaptic > 250) iosTick();
        }
        else iosTimers.push(setTimeout(iosTick, at));
      }
      at += Math.max(0, ms);
    });
  } catch {
    /* not supported */
  }
}
