// CoopSetu offline PWA service worker (Phase 8, MVP scope per
// REQUIREMENT.MD §21). Deliberately narrow: it only ever affects requests
// for URLs the app explicitly asked it to cache (via a CACHE_URL message,
// sent when a trainee downloads a course module for offline viewing —
// lib/offline/db.ts + app/dashboard/courses/page.tsx). Every other request —
// every API call, every authenticated fetch, every navigation — passes
// straight through to the network untouched. This worker never does
// blanket/opportunistic caching of app traffic; doing so would risk
// stale-serving authenticated JSON responses, which would be a real
// correctness and security bug, not just a UX one.

const CACHE_NAME = 'coopsetu-module-assets-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'CACHE_URL' && data.url) {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => cache.add(data.url))
        .then(() => event.source && event.source.postMessage({ type: 'CACHE_URL_DONE', url: data.url, ok: true }))
        .catch((err) => event.source && event.source.postMessage({ type: 'CACHE_URL_DONE', url: data.url, ok: false, error: String(err) })),
    );
  } else if (data.type === 'UNCACHE_URL' && data.url) {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.delete(data.url)));
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (!cached) {
        // Not something we were asked to cache — normal network request,
        // no interception.
        return fetch(event.request);
      }
      // Cache-first for a downloaded module asset; refresh it in the
      // background so the next offline session has the latest version,
      // without blocking this (possibly offline) response on the network.
      event.waitUntil(
        fetch(event.request)
          .then((res) => { if (res && res.ok) cache.put(event.request, res); })
          .catch(() => {}),
      );
      return cached;
    }),
  );
});
