const CACHE_NAME = 'site-cache-v1.2';
const OFFLINE_URLS = ['./', 'index.html', 'manifest.json', 'style.css', 'script.js'];

// During installation, simply store the files
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
});

// Delete old caches during activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Main logic: network request -> if error -> cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip caching for external real-time resources (Map and Weather API)
  if (url.hostname.includes('alerts.in.ua') || url.hostname.includes('open-meteo.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful GET requests
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Update the cache "on the fly"
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      })
      .catch(() => {
        // If the network is unavailable, look in the cache
        return caches.match(event.request);
      })
  );
});