// 麻將戰國列傳 — Service Worker
// 策略：HTML 永遠從網路取得（保證最新版），靜態資源快取加速
// BUILD: 20261115_1350
const CACHE_NAME = 'jcmj-v5';

// 只快取不常變動的靜態資源
const STATIC_ASSETS = [
  '/jcmj/icon-192.png',
  '/jcmj/icon-512.png',
  '/jcmj/manifest.json',
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

  // HTML 文件：走網路，失敗時才用快取
  if (event.request.destination === 'document' ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/jcmj/' ||
      url.pathname === '/jcmj') {
    // V1.28：拿掉 cache:'reload'。主檔 12 MB（壓縮後 9 MB），原本每次開都整包重抓，
    // iPad 從主畫面開會黑畫面等很久。現在照一般 HTTP 快取：10 分鐘內直接用，
    // 之後用 ETag 問伺服器 —— 沒改版只回 304（幾百位元組），有改版才下載新的。
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.ok) {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        }
        return response;
      }).catch(() =>
        // 離線時才用快取（舊寫法 `caches.match(a) || caches.match(b)` 永遠只走前者：Promise 一定是真值）
        caches.match(event.request).then(r => r || caches.match('/jcmj/'))
      )
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
