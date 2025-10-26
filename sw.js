const CACHE_NAME = 'music-player-v5';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// Install service worker and cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Only cache files that exist and are important
        const criticalUrls = [
          './',
          './index.html',
          './styles.css',
          './script.js',
          './manifest.json'
        ];
        
        return cache.addAll(criticalUrls)
          .catch((error) => {
            console.log('Cache addAll failed, trying individual caching:', error);
            // Try to cache each file individually
            return Promise.all(
              criticalUrls.map(url => 
                fetch(url)
                  .then(response => {
                    if (response.ok) {
                      return cache.put(url, response);
                    }
                  })
                  .catch(err => console.log(`Failed to cache ${url}:`, err))
              )
            );
          });
      })
      .catch((error) => {
        console.log('Cache opening failed:', error);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }
        
        // Don't cache blob URLs or try to fetch them
        if (event.request.url.startsWith('blob:')) {
          return fetch(event.request).catch(() => {
            // Return a blank response if fetch fails for blob URLs
            return new Response('', {status: 200});
          });
        }
        
        // Fetch from network
        return fetch(event.request)
          .then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // Don't cache if it's not a basic response
            if (response.type !== 'basic' && response.type !== 'cors') {
              return response;
            }

            // Clone the response for caching
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              })
              .catch((error) => {
                console.log('Cache put failed:', error);
              });

            return response;
          })
          .catch((error) => {
            console.log('Network request failed, returning cached or offline response:', error);
            // Return a cached response if available, otherwise offline page
            return caches.match(event.request)
              .then((cachedResponse) => {
                return cachedResponse || new Response('Offline - page not cached', {status: 503});
              });
          });
      })
      .catch((error) => {
        console.log('Cache match failed:', error);
        return new Response('Service Worker Error', {status: 500});
      })
  );
});

// Activate service worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for when the app comes back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Background sync triggered');
    // You could implement background sync logic here
  }
});

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const options = {
      body: event.data.text(),
      icon: './icons/icon-192x192.png',
      badge: './icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      },
      actions: [
        {
          action: 'explore', 
          title: 'Open Music Player',
          icon: './icons/icon-192x192.png'
        },
        {
          action: 'close', 
          title: 'Close notification',
          icon: './icons/icon-192x192.png'
        },
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification('Rebecca Media Player', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('./')
    );
  }
});

console.log('Service Worker loaded');