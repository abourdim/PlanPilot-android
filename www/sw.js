/* ═══════════════════════════════════════════════════════════════════
   SERVICE WORKER — PlanPilot
   Cache-first strategy for offline support.
   ═══════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'planpilot-v1';

const ASSETS = [
  './',
  './index.html',
  './css/variables.css',
  './css/layout.css',
  './css/sidebar.css',
  './css/calendar.css',
  './css/task-event.css',
  './css/modal.css',
  './css/popover.css',
  './css/settings.css',
  './css/analytics.css',
  './js/utils.js',
  './js/i18n.js',
  './js/store.js',
  './js/task-model.js',
  './js/history.js',
  './js/scheduler.js',
  './js/conflict-checker.js',
  './js/focus-score.js',
  './js/dependencies.js',
  './js/search.js',
  './js/notifications.js',
  './js/export-import.js',
  './js/sidebar-view.js',
  './js/calendar-view.js',
  './js/modal-view.js',
  './js/popover-view.js',
  './js/task-actions.js',
  './js/settings-view.js',
  './js/analytics-view.js',
  './js/habits-view.js',
  './js/onboarding.js',
  './js/app.js',
  './lang/fr.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './manifest.json'
];

/* ── Install: cache all app assets ── */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ── Fetch: cache-first, network fallback ── */

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then((networkResponse) => {
            // Cache successful GET responses
            if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(event.request, responseToCache));
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return new Response('', { status: 408, statusText: 'Offline' });
          });
      })
  );
});

/* ── Activate: clean up old caches ── */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});
