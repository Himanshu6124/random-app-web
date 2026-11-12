// Minimal service worker: makes RandoMeet installable as an app.
// It deliberately caches nothing — every request goes straight to the network,
// so live chat and dev-server updates are never served stale.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  /* pass-through */
});
