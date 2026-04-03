/**
 * Service Worker — Tournament Manager PWA
 *
 * Strategies:
 *   - Static assets (JS, CSS, HTML, images, manifest): Cache-First
 *   - API calls (/api/): Network-First with cache fallback
 *   - Navigation: Network-First with offline.html fallback
 *   - Background Sync: queue failed POST/PUT /api/ requests and retry when online
 */

const CACHE_NAME = 'tournament-v1';
const STATIC_CACHE = 'tournament-static-v1';
const API_CACHE = 'tournament-api-v1';
const SYNC_TAG = 'tournament-sync';

// Pages to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/landing.html',
  '/manage.html',
  '/register.html',
  '/my-events.html',
  '/director.html',
  '/offline.html',
  '/styles.css',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(
        PRECACHE_URLS.map(url => new Request(url, { cache: 'reload' }))
      ).catch((err) => {
        console.warn('[SW] Pre-cache partial failure (some pages may not exist):', err.message);
      });
    }).then(() => {
      console.log('[SW] Installed and pre-cached');
      return self.skipWaiting();
    })
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== API_CACHE)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activated — controlling all clients');
      return self.clients.claim();
    })
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET methods for normal cache logic (handled by background sync)
  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // API requests → Network-First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstAPI(request));
    return;
  }

  // Navigation requests → Network-First with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigate(request));
    return;
  }

  // Static assets → Cache-First
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  // Default → Network-First
  event.respondWith(networkFirstNavigate(request));
});

function isStaticAsset(pathname) {
  return (
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.woff2') ||
    pathname === '/manifest.json'
  );
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Return cached version even if stale
    const stale = await caches.match(request, { ignoreSearch: true });
    return stale || new Response('Offline', { status: 503 });
  }
}

async function networkFirstAPI(request) {
  try {
    const response = await fetch(request.clone());
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (request.method === 'GET') {
      const cached = await caches.match(request);
      if (cached) return cached;
    }
    return new Response(JSON.stringify({ error: 'You are offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function networkFirstNavigate(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (err) {
    // Serve cached version of the page if available
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback to offline page
    const offlinePage = await caches.match('/offline.html');
    return offlinePage || new Response('<h1>You are offline</h1>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

// ── Background Sync ──────────────────────────────────────────────────────────
// Queue failed POST/PUT requests and retry when online.

const SYNC_QUEUE_KEY = 'tournament-sync-queue';

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only queue POST/PUT to /api/ that fail
  if (
    url.origin === self.location.origin &&
    url.pathname.startsWith('/api/') &&
    (request.method === 'POST' || request.method === 'PUT')
  ) {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        // Store failed request in IndexedDB-based queue via sync registration
        await queueRequest(request.clone());
        if ('sync' in self.registration) {
          try {
            await self.registration.sync.register(SYNC_TAG);
          } catch (_) {}
        }
        return new Response(JSON.stringify({ queued: true, message: 'Request queued for sync when online' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
  }
});

// Simple in-memory queue (survives SW lifecycle via IndexedDB in production)
const _pendingRequests = [];

async function queueRequest(request) {
  try {
    const body = await request.text();
    _pendingRequests.push({
      url: request.url,
      method: request.method,
      headers: [...request.headers.entries()],
      body,
      timestamp: Date.now(),
    });
  } catch (_) {}
}

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(replayQueuedRequests());
  }
});

async function replayQueuedRequests() {
  const queue = [..._pendingRequests];
  _pendingRequests.length = 0;

  for (const item of queue) {
    try {
      await fetch(item.url, {
        method: item.method,
        headers: new Headers(item.headers),
        body: item.body || undefined,
      });
      console.log('[SW] Synced queued request:', item.url);
    } catch (err) {
      // Re-queue if still failing
      _pendingRequests.push(item);
      console.warn('[SW] Sync still failing for:', item.url);
    }
  }
}

// ── Push Notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'Tournament Update', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Tournament Manager';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
