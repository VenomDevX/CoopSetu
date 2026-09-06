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

// A second, separate cache for the app shell. Kept apart from the module cache
// on purpose: module assets are user-chosen downloads that must survive, while
// the shell is disposable and versioned. Bump SHELL_CACHE to retire an old one.
//
// Without this, navigating to the dashboard while offline showed the browser's
// error page — downloaded course content was only reachable if the tab happened
// to already be open, which is not much use to a trainee on a train.
const SHELL_CACHE = 'coopsetu-app-shell-v1';
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // Best-effort: a failed precache must not block activation, or a single
      // 404 would leave the worker permanently installing.
      .then((cache) => cache.addAll([OFFLINE_URL, '/manifest.json']).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== SHELL_CACHE)
          .map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
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

  // Navigations get network-first with an offline fallback. Deliberately NOT
  // cache-first: dashboard HTML is per-user and Cache-Control: no-store, so
  // serving a stale copy could show one trainee another's page. The fallback
  // is a static page that explains the state and lists what is available
  // offline — never a cached authenticated document.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.open(SHELL_CACHE).then((cache) =>
          cache.match(OFFLINE_URL).then((cached) =>
            cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }),
          ),
        ),
      ),
    );
    return;
  }

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
