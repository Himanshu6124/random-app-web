// Minimal service worker: makes RandomChatly installable as an app and shows notifications.
// It deliberately caches nothing — every request goes straight to the network,
// so live chat and dev-server updates are never served stale.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  /* pass-through */
});

// Clicking a message / friend-request notification focuses the app and opens the right screen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.target || null;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find((c) => 'focus' in c);
    if (client) {
      await client.focus();
      client.postMessage({ type: 'notification-click', target });
      return;
    }
    if (self.clients.openWindow) await self.clients.openWindow('/');
  })());
});
