// 麻將戰國列傳 — Service Worker
// 版本號由 index.html 在安裝時動態傳入（時間戳記），
// 因此每次上傳新版 index.html 後，使用者都會自動取得最新內容。
let CACHE_NAME = 'dila-mj-v1'; // 預設值，會被 index.html 覆蓋

const ASSETS = [
  '/dila-mj/',
  '/dila-mj/index.html',
  '/dila-mj/icon-192.png',
  '/dila-mj/icon-512.png',
  '/dila-mj/manifest.json',
];

// ── 接收來自頁面的版本號 ────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SET_VERSION') {
    CACHE_NAME = 'dila-mj-' + event.data.version;
  }
});

// ── 安裝：預先快取所有資源 ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] 快取遊戲資源，版本：', CACHE_NAME);
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── 啟動：清除舊版快取 ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('dila-mj-') && k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] 清除舊快取：', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── 攔截請求：快取優先，網路備用 ───────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

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
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('/dila-mj/index.html');
        }
      });
    })
  );
});
