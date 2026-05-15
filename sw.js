const CACHE = 'beekeepy-v2';
const ASSETS = ['/', '/app.html', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).catch(()=>{})
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.hostname.includes('supabase.co')) return;
  if (!url.hostname.includes('beekeepy.com') && url.hostname !== 'localhost') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          try {
            caches.open(CACHE).then(c => c.put(e.request, res.clone())).catch(()=>{});
          } catch(err) {}
        }
        return res;
      }).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('/app.html');
      });
    }).catch(()=>{})
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
