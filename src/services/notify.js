/**
 * App notifications: a short in-app toast while the tab is in view, and a browser (system)
 * notification while it is hidden or unfocused. Clicking either one navigates the app to
 * `target` ({ tab: 'friends', friendId } or { tab: 'match' }).
 *
 * Toasts are deliberately small and brief: they slide in at the top, never cover the composer,
 * disappear after a few seconds, and a newer alert with the same `key` replaces the older one
 * instead of stacking up.
 */

const TOAST_MS = 4500;
const MAX_TOASTS = 3;
const DISMISS_KEY = 'rc.notifyPromptDismissed';

const toastListeners = new Set();
const navigateListeners = new Set();
let toasts = [];
let seq = 0;

function emitToasts() {
  toastListeners.forEach((fn) => fn(toasts));
}

export function subscribeToasts(fn) {
  toastListeners.add(fn);
  fn(toasts);
  return () => toastListeners.delete(fn);
}

export function subscribeNavigate(fn) {
  navigateListeners.add(fn);
  return () => navigateListeners.delete(fn);
}

export function navigateTo(target) {
  if (!target) return;
  navigateListeners.forEach((fn) => fn(target));
}

export function dismissToast(id) {
  toasts = toasts.filter((t) => t.id !== id);
  emitToasts();
}

function pushToast(toast) {
  const id = ++seq;
  const item = { ...toast, id };
  toasts = [...toasts.filter((t) => !toast.key || t.key !== toast.key), item].slice(-MAX_TOASTS);
  emitToasts();
  setTimeout(() => dismissToast(id), toast.duration || TOAST_MS);
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

/** Asks the browser for permission. Must be called from a click/tap. */
export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function isPromptDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

export function dismissPrompt() {
  try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ }
}

export function pageInView() {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible' && (typeof document.hasFocus !== 'function' || document.hasFocus());
}

async function showSystemNotification({ key, title, body, icon, target }) {
  if (notificationPermission() !== 'granted') return;
  const options = {
    body,
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: key || undefined,
    renotify: Boolean(key),
    data: { target },
  };
  try {
    // A service worker notification works everywhere (Android Chrome forbids `new Notification`).
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg?.showNotification) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    /* fall back below */
  }
  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      navigateTo(target);
      n.close();
    };
  } catch {
    /* not allowed here */
  }
}

/**
 * Raise one alert. `kind` styles the toast (message | request | match | success).
 * `action` is an optional { label, run } button on the toast (e.g. Accept).
 */
export function notify({ key, kind = 'message', title, body, icon, target, action }) {
  if (pageInView()) {
    pushToast({ key, kind, title, body, icon, target, action });
  } else {
    showSystemNotification({ key, title, body, icon, target });
  }
}

// Clicks on service-worker notifications come back to the page as a message.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener?.('message', (event) => {
    if (event.data?.type === 'notification-click') navigateTo(event.data.target);
  });
}
