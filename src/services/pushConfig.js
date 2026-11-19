/**
 * Web push configuration. Kept dependency-free so the service-worker registration (mobile/nativeShell)
 * and the push client can both import it without a cycle.
 *
 * All values are public web-config values (see .env.example).
 */

/** Firebase web config, or null when the VITE_FIREBASE_* values are not all set. */
export function getFirebaseWebConfig() {
  const {
    VITE_FIREBASE_API_KEY: apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: authDomain,
    VITE_FIREBASE_PROJECT_ID: projectId,
    VITE_FIREBASE_STORAGE_BUCKET: storageBucket,
    VITE_FIREBASE_APP_ID: appId
  } = import.meta.env;
  if (!apiKey || !authDomain || !projectId || !storageBucket || !appId) return null;
  // A web app id looks like "1:<messagingSenderId>:web:<hash>", so the sender id needs no extra variable.
  const messagingSenderId = String(appId).split(':')[1] || '';
  return { apiKey, authDomain, projectId, storageBucket, appId, messagingSenderId };
}

/** VAPID public key from Firebase console > Cloud Messaging > Web Push certificates. */
export function getVapidKey() {
  return import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
}

/**
 * URL the service worker is registered with. The Firebase config travels in the query string so the
 * worker can start on its own (for a push that arrives while the app is closed) without any page open.
 */
export function serviceWorkerUrl() {
  const cfg = getFirebaseWebConfig();
  if (!cfg || !cfg.messagingSenderId) return '/sw.js';
  return `/sw.js?fb=${encodeURIComponent(btoa(JSON.stringify(cfg)))}`;
}
