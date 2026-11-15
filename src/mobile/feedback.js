/**
 * App-wide haptic vocabulary. Every buzz goes through haptic() in nativeShell
 * (Vibration API on Android, switch tick on iOS), so platform quirks live there.
 *
 * Patterns are deliberately short: a tap is a tick, not a buzz. Named events
 * keep the feel consistent: the same "success" everywhere, the same "match".
 */
import { haptic } from './nativeShell';

const PATTERNS = {
  tap: 6,                         // any button / row press
  select: 10,                     // choosing an option, toggling
  send: 12,                       // message sent
  receive: [8, 50, 8],            // message arrived
  success: [12, 60, 18],          // request accepted, saved, connected
  match: [18, 70, 24, 70, 40],    // a match landed: build-up then a thump
  notify: [10, 80, 10],           // alert slid in (wave, friend request)
  warning: [20, 60, 20],          // destructive confirm shown
  error: [30, 50, 30, 50, 30],    // something failed
  long: 25,                       // long-press menu opened
};

let enabled = true;
export function setHapticsEnabled(on) { enabled = !!on; }

export function feedback(kind = 'tap') {
  if (!enabled) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  haptic(PATTERNS[kind] ?? PATTERNS.tap);
}

// Things you tap that are not <button>s (rows built from divs) still get a tick.
const TAPPABLE = [
  'button:not(:disabled)',
  '[role="button"]:not([aria-disabled="true"])',
  'a[href]',
  '.friends-list > div',
  '.dc-person-row',
  '.history-row',
  '.discover-nav-item',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'select',
].join(',');

// Elements that already fire their own haptic: skip them so taps don't double-buzz.
const OWN_HAPTIC = '.bottom-tabbar, [data-no-haptic], .ios-haptic, .tabbar-haptic';

/**
 * One delegated listener gives every tappable element a light tick and a
 * `.is-pressed` class for the press animation (motion.css). Call once at boot.
 */
export function initTapFeedback() {
  if (typeof document === 'undefined') return;

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const PILL = '.btn-primary, .btn-cyan, .btn-secondary, .btn-danger, .dc-btn, input, select';

  let pressed = null;
  const release = () => {
    const el = pressed;
    pressed = null;
    if (!el) return;
    el.classList.remove('is-pressed');
    // Spring back a touch past rest. WAAPI keeps this apart from CSS animations
    // (row entrances etc.) and from the element's own transitions.
    if (!reduceMotion?.matches && !el.matches(PILL) && typeof el.animate === 'function') {
      try {
        el.animate(
          [{ scale: '0.96' }, { scale: '1.02', offset: 0.55 }, { scale: '1' }],
          { duration: 280, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
        );
      } catch { /* older engines without individual transform props */ }
    }
  };

  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const el = e.target.closest?.(TAPPABLE);
    if (!el || el.closest(OWN_HAPTIC)) return;
    release();
    pressed = el;
    el.classList.add('is-pressed');
  }, { passive: true, capture: true });

  ['pointerup', 'pointercancel', 'scroll'].forEach((type) =>
    document.addEventListener(type, release, { passive: true, capture: true })
  );

  // Fire the tick on click (a committed tap), not pointerdown, so scrolling a
  // list doesn't buzz on every row the finger lands on.
  document.addEventListener('click', (e) => {
    // A tap on an IosHaptic overlay already ticked natively.
    if (e.target.closest?.(OWN_HAPTIC)) return;
    const el = e.target.closest?.(TAPPABLE);
    if (!el || el.closest(OWN_HAPTIC)) return;
    feedback(el.matches('input[type="checkbox"], input[type="radio"], select') ? 'select' : 'tap');
  }, { capture: true });
}
