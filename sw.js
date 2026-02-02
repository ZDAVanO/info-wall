const CACHE_NAME = 'site-cache';
const OFFLINE_URLS = ['./', 'index.html', 'manifest.json', 'style.css', 'script.js'];

// During installation, simply store the files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
});

// Main logic: network request -> if error -> cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If a response is received from the network, update the cache "on the fly"
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(() => {
        // If the network is unavailable (fetch error), look in the cache
        return caches.match(event.request);
      })
  );
});