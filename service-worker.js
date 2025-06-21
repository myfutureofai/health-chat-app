const CACHE_NAME = 'health-chat-cache-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.jpg',
  '/offline.html',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/cropperjs@1.5.13/dist/cropper.min.js',
  'https://cdn.jsdelivr.net/npm/cropperjs@1.5.13/dist/cropper.min.css'
];

// Install: cache all core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('✅ Caching app shell');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('🧹 Clearing old cache:', name);
            return caches.delete(name);
          }
        })
      )
    )
  );
  self.clients.claim(); // Claim control
});

// Fetch: network-first, fallback to cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, res.clone());
          return res;
        });
      })
      .catch(() => {
        return caches.match(event.request).then((res) => {
          if (res) return res;
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
        });
      })
  );
});
