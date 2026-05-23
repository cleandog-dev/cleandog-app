// CleanDOG Service Worker — install + push notifications.
// Online-only (no offline caching for now).
// VERSION: bump this string to force-update SW on existing clients.
const SW_VERSION = 'v3-2026-05-22';

self.addEventListener('install', () => {
  console.log('[sw]', SW_VERSION, 'installing');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Empty pass-through fetch handler.
// Chrome PWA install criteria: needs a fetch listener registered.
// Active interception (respondWith) is NOT required and can interfere
// with Android Chrome's native install prompt — keep this listener empty.
self.addEventListener('fetch', () => {});

// ── Push event ────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: 'CleanDOG', body: event.data.text() };
  }

  const title = payload.title || 'CleanDOG';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon',
    badge: payload.badge || '/icon',
    tag: payload.tag,
    data: {
      url: payload.url || '/',
      ...payload.data,
    },
    requireInteraction: payload.requireInteraction || false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Click on notification ─────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Focus existing tab if matches origin
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      // Else open new
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
