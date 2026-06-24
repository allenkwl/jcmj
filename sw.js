// 麻將戰國列傳 — Service Worker
// 策略：HTML 永遠從網路取得（保證最新版），靜態資源快取加速
// BUILD: 20260624_0000
const CACHE_NAME = 'dila-mj-v3';

// 只快取不常變動的靜態資源
const STATIC_ASSETS = [
  '/dila-mj/icon-192.png',
  '/dila-mj/icon-512.png',
  '/dila-mj/manifest.json',
];

// ── 安裝：預先快取靜態資源 ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── 啟動：清除所有舊版快取 ──────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── 攔截請求 ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // HTML 文件：永遠走網路，失敗時才用快取（保證更新能到達使用者）
  if (event.request.destination === 'document' ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/dila-mj/' ||
      url.pathname === '/dila-mj') {
    event.respondWith(
      fetch(event.request).then(response => {
        // 順便更新快取
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // 離線時才用快取
        return caches.match(event.request) || caches.match('/dila-mj/');
      })
    );
    return;
  }

  // 靜態資源：快取優先，加速載入
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      });
    })
  );
});
