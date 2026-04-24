// EduPro Service Worker — offline caching strategy
const CACHE_NAME = 'edupro-v1';
const APP_SHELL = [
  '/',
  '/index.html',
];

// ── Install: cache app shell ───────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ─────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for assets ───
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and external API calls (Supabase, AI gateway)
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co') || url.hostname.includes('fastrouter.io')) return;

  // Cache-first for static assets (JS, CSS, fonts, images)
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg')
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) => cached ?? fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Network-first for HTML/navigation — fallback to cached index.html
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match('/index.html').then((cached) => cached ?? new Response('Offline', { status: 503 }))
    )
  );
});

// ── Background sync (future: use BackgroundSync API) ───────
self.addEventListener('sync', (event) => {
  if (event.tag === 'edupro-sync') {
    // Notify the app to trigger smartSync
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => client.postMessage({ type: 'TRIGGER_SYNC' }));
    });
  }
});
