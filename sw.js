// ============================================================
// HiveDash Service Worker
// 每次发布新版本，把下面的版本号 +1，用户下次访问自动更新
// ============================================================
const CACHE_VERSION = 'v2';
const CACHE_NAME = 'hivedash-' + CACHE_VERSION;

// 需要预缓存的静态资源
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/manifest.json',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png'
];

// ── Install：预缓存静态资源 ──────────────────────────────────
self.addEventListener('install', event => {
  // 立即激活，不等待旧 SW 关闭
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[SW] Pre-cache failed for some assets:', err);
      });
    })
  );
});

// ── Activate：删除所有旧版本缓存 ────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key.startsWith('hivedash-') && key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      // 立即接管所有页面，不用等刷新
      return self.clients.claim();
    })
  );
});

// ── Fetch：网络优先策略 ──────────────────────────────────────
// 对 HTML 页面始终走网络（保证拿到最新版本）
// 对静态资源走缓存优先（提升速度）
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 只处理同源请求
  if (url.origin !== location.origin) return;

  // HTML 页面：网络优先，失败才用缓存
  if (event.request.mode === 'navigate' ||
      event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 更新缓存
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // 网络失败，用缓存兜底（离线模式）
          return caches.match(event.request) || caches.match('/app.html');
        })
    );
    return;
  }

  // 其他静态资源：缓存优先，没有再去网络
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// ── Push 通知 ────────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || 'HiveDash';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/favicon.png',
    data: data.url || '/',
    vibrate: [200, 100, 200]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});

// ── 接收来自页面的消息 ───────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'ENABLE_PUSH') {
    // Push 启用时的处理（预留）
    console.log('[SW] Push notifications enabled');
  }
});
