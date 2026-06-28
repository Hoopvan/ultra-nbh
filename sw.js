const CACHE = 'hoop-nbh-v41';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo-nbh.png',
  '/js/supabase.min.js',
  '/js/main.js',
  '/js/config.js',
  '/js/state.js',
  '/js/auth.js',
  '/js/ui.js',
  '/js/nav.js',
  '/js/profile.js',
  '/js/profile-create.js',
  '/js/avatar.js',
  '/js/cards.js',
  '/js/community.js',
  '/js/tuto.js',
  '/js/date.js',
  '/js/push.js',
  '/js/utils.js',
  '/js/admin.js',
  '/js/games/loader.js',
  '/js/games/screens.js',
  '/js/games/pouls.js',
  '/js/games/vestiaire.js',
  '/js/games/anecdote.js',
  '/js/games/nantes-nbh.js',
  '/js/games/avant-apres.js',
  '/js/games/pronostic.js',
  '/js/games/boite.js',
  '/js/games/timeline.js',
  '/js/games/photo-mystere.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

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

self.addEventListener('fetch', e => {
  // Laisser passer les requêtes externes sans interception
  const url = e.request.url;
  if (url.includes('supabase.co'))        return;
  if (url.includes('dicebear.com'))       return;
  if (url.includes('fonts.googleapis.com')) return;
  if (url.includes('fonts.gstatic.com'))  return;
  if (url.includes('googleusercontent.com')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const ct = res.headers.get('content-type') || '';
        const cacheable = res.ok && (
          ct.includes('text/') ||
          ct.includes('application/javascript') ||
          ct.includes('application/json') ||
          ct.includes('image/') ||
          ct.includes('font/')
        );
        if (cacheable) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
