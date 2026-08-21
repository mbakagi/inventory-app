// Service worker for ST3S Inventory - offline support
const CACHE = 'st3s-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/storage.js',
  './js/overrides.js',
  './js/fuzzy.js',
  './js/catalog.js',
  './js/scanner.js',
  './js/ocr.js',
  './js/excel.js',
  './js/taxonomy.js',
  './js/app.js',
  './js/pwa.js',
  './assets/favicon.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-192.png',
  './assets/icon-maskable-512.png',
  './assets/products.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const origin = self.location.origin;

  // Catalog: network-first (updates propagate) with cache fallback
  if (url.origin === origin && url.pathname.endsWith('products.json')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cross-origin (CDN libs): stale-while-revalidate
  if (url.origin !== origin) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(e.request).then((cached) => {
          const network = fetch(e.request)
            .then((res) => {
              if (res && (res.status === 200 || res.type === 'opaque')) {
                cache.put(e.request, res.clone());
              }
              return res;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // Same-origin: cache-first, fallback network
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
