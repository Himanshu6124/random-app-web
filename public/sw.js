// RandomChatly service worker.
//
// 1. Makes the app installable and shows notifications.
// 2. Receives Firebase Cloud Messaging web pushes, so a notification is shown even when the app or the
//    browser is closed. The server only pushes to people who have no open socket connection.
//
// It deliberately caches nothing: every request goes straight to the network, so live chat and
// dev-server updates are never served stale.
//
// The Firebase config arrives in the registration URL (?fb=<base64 JSON>, see src/services/pushConfig.js).
// Reading it from the URL lets this worker start by itself when a push wakes it up.

const FIREBASE_SDK_VERSION = '11.10.0';

function readFirebaseConfig() {
  try {
    const raw = new URL(self.location.href).searchParams.get('fb');
    return raw ? JSON.parse(atob(raw)) : null;
  } catch {
    return null;
  }
}

// Data-only pushes: the server sends title, body, tag and target, and we render them here. The browser
// never shows a notification on its own, so every alert looks and routes the same way.
function showPushNotification(data) {
  let target = null;
  try {
    target = data.target ? JSON.parse(data.target) : null;
  } catch {
    target = null;
  }
  return self.registration.showNotification(data.title || 'RandomChatly', {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { target }
  });
}

const fbConfig = readFirebaseConfig();
if (fbConfig && fbConfig.projectId && fbConfig.messagingSenderId) {
  try {
    importScripts(
      `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js`,
      `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js`
    );
    firebase.initializeApp(fbConfig);
    firebase.messaging().onBackgroundMessage((payload) => showPushNotification(payload.data || {}));
  } catch {
    // Push simply stays off; the rest of the worker still works.
  }
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  /* pass-through */
});

// Clicking a message / friend-request notification focuses the app and opens the right screen.
// If no window is open, the target travels in the URL and the app opens it on load (see App.jsx).
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
    if (self.clients.openWindow) {
      const url = target ? `/?target=${encodeURIComponent(JSON.stringify(target))}` : '/';
      await self.clients.openWindow(url);
    }
  })());
});
