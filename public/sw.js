/**
 * ScholarOS Service Worker
 * Handles: Web Push notifications, offline caching
 */

const CACHE_NAME = 'scholar-os-v1';
const OFFLINE_URLS = ['/', '/index.html'];

// ---- Install: cache shell ----
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS).catch(() => {}))
  );
});

// ---- Activate: clean old caches ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ---- Fetch: serve cached shell offline ----
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return; // Never cache API calls

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(r => r || caches.match('/index.html'))
    )
  );
});

// ---- Push: show notification ----
self.addEventListener('push', event => {
  let data = { title: 'ScholarOS', body: 'Time to study!', icon: '/icons/icon-192.png' };
  try { data = { ...data, ...event.data.json() }; } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'scholar-reminder',
      renotify: true,
      data: { url: data.url || '/' },
      actions: [
        { action: 'study', title: 'Start Studying' },
        { action: 'dismiss', title: 'Later' }
      ]
    })
  );
});

// ---- Notification click: open app ----
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const existing = clients.find(c => c.url === url && 'focus' in c);
      return existing ? existing.focus() : self.clients.openWindow(url);
    })
  );
});
