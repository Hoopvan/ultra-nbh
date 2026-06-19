const CACHE = 'hoop-nbh-v13';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/js/main.js',
  '/js/config.js',
  '/manifest.json'
];

// Installation — mise en cache des assets statiques
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activation — supprime les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Push notifications
self.addEventListener('push', e => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Hoop NBH 🏀', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'));
});

// Fetch — réseau d'abord, cache en fallback
self.addEventListener('fetch', e => {
  // Ne pas intercepter les requêtes externes (Supabase, CDN)
  if (e.request.url.includes('supabase.co')) return;
  if (e.request.url.includes('jsdelivr.net')) return;
  if (e.request.url.includes('fonts.googleapis.com')) return;
  if (e.request.url.includes('fonts.gstatic.com')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Met à jour le cache avec la réponse fraîche
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
