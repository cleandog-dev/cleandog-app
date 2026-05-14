// Minimal service worker — required for PWA install prompt
// Does not cache anything (online-only); future versions can add offline support.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through: let the browser handle requests normally.
});
