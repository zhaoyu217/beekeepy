// HiveDash service worker — network-first app shell, offline fallback.
// v6: fixes stale-app bug (was cache-first for everything) and stops
// intercepting cross-origin (Supabase / Google / CDN) requests.
const CACHE = 'hivedash-v7';
const SHELL = '/app.html';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Never touch cross-origin requests (Supabase auth/data, Google sign-in,
  // CDN fonts/scripts). They must always hit the live network.
  if (url.origin !== self.location.origin) return;

  // App shell & navigations: NETWORK-FIRST so users always get the latest
  // version; fall back to the cached shell only when offline.
  if (req.mode === 'navigate' || url.pathname === '/app.html' || url.pathname === '/app') {
    e.respondWith(
      fetch(req)
        .then(resp => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(SHELL, clone)).catch(() => {});
          }
          return resp;
        })
        .catch(() => caches.match(SHELL))
    );
    return;
  }

  // Other same-origin static assets (icons, manifest): cache-first is fine.
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {});
        }
        return resp;
      }).catch(() => cached)
    )
  );
});

// ---- Web Push ----
self.addEventListener('push', function(e){
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { try { data = { body: e.data.text() }; } catch (e2) { data = {}; } }
  var title = data.title || 'HiveDash';
  var opts = {
    body: data.body || 'A hive needs your attention.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'hivedash-reminder',
    data: { url: data.url || '/app.html' }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/app.html';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(wins){
      for (var i = 0; i < wins.length; i++){
        if (wins[i].url.indexOf('/app') > -1 && 'focus' in wins[i]) return wins[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
