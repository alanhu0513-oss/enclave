var CACHE_NAME = 'enclave-v3';

/* ─── Install: Skip waiting, don't pre-cache (network-first) ─── */
self.addEventListener('install', function (event) {
  self.skipWaiting();
});

/* ─── Activate: Delete ALL old caches ─── */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keyList) {
      return Promise.all(
        keyList.map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ─── Fetch: Network-first, cache fallback ─── */
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then(function (response) {
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function () {
      return caches.match(event.request);
    })
  );
});
