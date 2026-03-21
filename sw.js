/**
 * Xperiences PWA — Service Worker v5.0
 * Tres apps instalables independientes: index.html, admin.html, portal.html
 * Cada una carga solo su propio JS. core.js es compartido.
 */
const CACHE_NAME = 'xperiences-v5-0';

const STATIC_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './portal.html',
  './manifest.json',
  './manifest-admin.json',
  './manifest-portal.json',
  './assets/css/styles.css',
  './assets/js/core.js',
  './assets/js/app-public.js',
  './assets/js/app-admin.js',
  './assets/js/app-portal.js',
  './assets/data/seed.js',
  './assets/img/logo-xperiences.png',
  './assets/img/xp-icon-192.png',
  './assets/img/xp-icon-512.png',
  './assets/img/xp-apple-touch-icon.png',
  './assets/img/admin-icon-192.png',
  './assets/img/admin-icon-512.png',
  './assets/img/admin-apple-touch-icon.png',
  './assets/img/portal-icon-192.png',
  './assets/img/portal-icon-512.png',
  './assets/img/portal-apple-touch-icon.png',
  './assets/img/xp-favicon-16.png',
  './assets/img/xp-favicon-32.png',
  './favicon.ico'
];

// Siempre red primero para páginas HTML y config
const NETWORK_FIRST = ['firebase-config.js','index.html','admin.html','portal.html'];

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  const netFirst = e.request.mode === 'navigate'
    || NETWORK_FIRST.some(p => url.pathname.endsWith(p));

  if (netFirst) {
    e.respondWith(
      fetch(e.request)
        .then(r => { if (r?.status === 200) caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone())); return r; })
        .catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      fetch(e.request).then(r => {
        if (r?.status === 200 && r.type !== 'opaque') caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone()));
      }).catch(() => {});
      return cached || fetch(e.request);
    })
  );
});
