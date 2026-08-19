// Service Worker for comprehensive caching strategies
// NOTE: bump CACHE_VERSION when cache behavior changes to force invalidation.
const CACHE_VERSION = 'v1.0.12';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

// Cache TTL configurations (in milliseconds)
const CACHE_TTL = {
  dynamic: 24 * 60 * 60 * 1000, // 24 hours
  images: 24 * 60 * 60 * 1000, // 24 hours
  static: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Assets to precache on install.
// Avoid precaching HTML/navigations: stale HTML can reference deleted hashed chunks after deploy.
const PRECACHE_ASSETS = [
  '/theme-init.js',
  // Self-hosted Urbanist. Precached so the UI keeps its typeface offline
  // instead of falling back to system-ui mid-shift.
  '/fonts/urbanist-latin.woff2',
  '/fonts/urbanist-latin-ext.woff2',
  '/icons/favicon-64.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
];

const SENSITIVE_API_PATHS = ['/rest/v1/', '/functions/v1/', '/storage/v1/'];
const SENSITIVE_QUERY_KEYS = [
  'access_token',
  'api_key',
  'apikey',
  'code',
  'key',
  'session_state',
  'state',
  'token',
];

// Performance metrics storage
const performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  cacheRetrievalTime: [],
};

// Install event - precache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Precaching static assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      // A Refresh now action in one tab claims every same-origin tab. Keep the
      // fresh exact hashed chunks for every retained generation. This also
      // covers a suspended sibling that spans two rapid deployments. Empty or
      // expired generations are removed; API caches remain unconditional.
      const managedCaches = cacheNames.filter((name) => {
        return name.startsWith('static-') ||
               name.startsWith('dynamic-') ||
               name.startsWith('api-') ||
               name.startsWith('images-');
      });
      return Promise.all(managedCaches.map(async (name) => {
        let shouldDelete = name.startsWith('api-') ||
          (name !== STATIC_CACHE &&
           !name.startsWith('dynamic-') &&
           name !== IMAGE_CACHE);

        if (name.startsWith('dynamic-') && name !== DYNAMIC_CACHE) {
          shouldDelete = !(await hasFreshVersionedAssets(name, CACHE_TTL.dynamic));
        } else if (name === DYNAMIC_CACHE) {
          shouldDelete = false;
        }

        if (!shouldDelete) return false;
        console.log('[SW] Deleting old cache:', name);
        return caches.delete(name);
      }));
    }).then(async () => {
      // Clear stale dynamic cache entries on activation
      // This ensures old hashed chunks don't cause "Failed to fetch dynamically imported module" errors
      // after a deployment when index.html references new chunks
      const dynamicCache = await caches.open(DYNAMIC_CACHE);
      const dynamicKeys = await dynamicCache.keys();
      await Promise.all(dynamicKeys.map(key => dynamicCache.delete(key)));
      console.log('[SW] Cleared', dynamicKeys.length, 'stale dynamic cache entries');
      await self.clients.claim();
      const windowClients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: 'window',
      });
      windowClients.forEach((client) => client.postMessage({
        type: 'WORKER_ACTIVATED',
        version: CACHE_VERSION,
      }));
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Never persist third-party responses. Cross-origin endpoints can carry
  // provider credentials or clinical data under query names unknown to us.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Authenticated and Supabase data requests are network-only. CacheStorage is
  // shared by every signed-in user for this origin, so caching these responses
  // could expose one clinician's patient data to the next session.
  if (isSensitiveRequest(request, url)) {
    return;
  }

  // SPA navigations / HTML should be network-first.
  // Caching HTML with a SW can easily cause "Failed to fetch dynamically imported module"
  // after a deployment when the cached HTML points at old hashed chunk filenames.
  if (request.mode === 'navigate' || isHtmlRequest(request)) {
    event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE, CACHE_TTL.dynamic));
    return;
  }

  if (url.pathname.startsWith('/assets/') && /\.(js|mjs|css)$/i.test(url.pathname)) {
    event.respondWith(networkFirstWithJsRetry(request, DYNAMIC_CACHE, CACHE_TTL.dynamic));
    return;
  }

  // Determine caching strategy based on request type
  if (isImageRequest(url)) {
    event.respondWith(cacheFirstWithNetwork(request, IMAGE_CACHE, CACHE_TTL.images));
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE, CACHE_TTL.static));
  } else {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
  }
});

function isSensitiveUrl(url) {
  return SENSITIVE_API_PATHS.some(path => url.pathname.includes(path)) ||
         SENSITIVE_QUERY_KEYS.some(key => url.searchParams.has(key));
}

function isSensitiveRequest(request, url) {
  return request.headers.has('authorization') ||
         request.headers.has('apikey') ||
         request.headers.has('cookie') ||
         isSensitiveUrl(url);
}

// Check if request is for an image
function isImageRequest(url) {
  return /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname);
}

// Check if request is for a static asset
function isStaticAsset(url) {
  return /\.(js|css|woff|woff2|ttf|eot)$/i.test(url.pathname);
}

// Check if request is for HTML
function isHtmlRequest(request) {
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

function isExpectedVersionedAssetResponse(request, response) {
  const pathname = new URL(request.url).pathname;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (/\.css$/i.test(pathname)) return contentType.includes('text/css');
  if (/\.(js|mjs)$/i.test(pathname)) {
    return contentType.includes('javascript') || contentType.includes('ecmascript');
  }
  return true;
}

async function networkFirstWithJsRetry(request, cacheName, ttl) {
  try {
    const response = await networkFirstWithCache(request, cacheName, ttl);
    if (!response.ok || !isExpectedVersionedAssetResponse(request, response)) {
      // An open tab can request a previous deployment's hashed chunk after the
      // host has removed it. Prefer the exact cached URL when available; this
      // never applies to HTML or unversioned responses.
      const currentCachedResponse = await getCachedResponse(request, cacheName, ttl);
      const cachedResponse = currentCachedResponse &&
        isExpectedVersionedAssetResponse(request, currentCachedResponse)
        ? currentCachedResponse
        : null;
      const retainedGenerationResponse = cachedResponse ??
        await getRetainedDynamicResponse(request, cacheName, ttl);
      if (retainedGenerationResponse) {
        performanceMetrics.cacheHits++;
        return retainedGenerationResponse;
      }
    }
    return response;
  } catch (error) {
    // A clinician can lose connectivity after deferring an update. The exact
    // chunk retained for that open tab remains authoritative in this path too.
    const retainedGenerationResponse = await getRetainedDynamicResponse(request, cacheName, ttl);
    if (retainedGenerationResponse) {
      performanceMetrics.cacheHits++;
      return retainedGenerationResponse;
    }

    const errorMessage = error?.message || '';
    const isStaleChunkError = errorMessage.includes('Failed to fetch') || errorMessage.includes('imported');
    if (isStaleChunkError) {
      console.log('[SW] Stale chunk detected, clearing cache and retrying:', request.url);
      await caches.open(cacheName).then(cache => cache.delete(request));
      try {
        return await networkFirstWithCache(request, cacheName, ttl);
      } catch (retryError) {
        console.error('[SW] Retry failed for stale chunk:', request.url);
        throw retryError;
      }
    }
    throw error;
  }
}

async function getRetainedDynamicResponse(request, currentCacheName, ttl) {
  const cacheNames = await caches.keys();
  const retainedCacheNames = cacheNames
    .filter((name) => name.startsWith('dynamic-') && name !== currentCacheName)
    .reverse();
  for (const cacheName of retainedCacheNames) {
    const response = await getCachedResponse(request, cacheName, ttl);
    if (response && isExpectedVersionedAssetResponse(request, response)) return response;
  }
  return null;
}

async function hasFreshVersionedAssets(cacheName, ttl) {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  for (const request of requests) {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin ||
        !url.pathname.startsWith('/assets/') ||
        !/\.(js|mjs|css)$/i.test(url.pathname)) {
      continue;
    }
    const response = await cache.match(request);
    const cachedAt = Number(response?.headers.get('sw-cache-time'));
    if (response && Number.isFinite(cachedAt) && Date.now() - cachedAt <= ttl) {
      return true;
    }
  }
  return false;
}

// Network First with Cache Fallback (for navigations and versioned assets)
async function networkFirstWithCache(request, cacheName, ttl) {
  const startTime = performance.now();
  
  try {
    performanceMetrics.networkRequests++;
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok && isExpectedVersionedAssetResponse(request, networkResponse)) {
      const cache = await caches.open(cacheName);
      const responseToCache = networkResponse.clone();
      
      // Add timestamp header for TTL checking
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());
      
      const responseWithTime = new Response(await responseToCache.blob(), {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });
      
      cache.put(request, responseWithTime);
    } else if (
      networkResponse.status >= 500 &&
      (request.mode === 'navigate' || isHtmlRequest(request))
    ) {
      // A hosting/edge outage is different from an authoritative 4xx. Keep
      // the installed app available with a fresh cached shell, while leaving
      // versioned JS/CSS and client errors on their network responses.
      performanceMetrics.cacheMisses++;
      const cachedResponse = await getCachedResponse(request, cacheName, ttl);
      if (cachedResponse) {
        performanceMetrics.cacheHits++;
        performanceMetrics.cacheRetrievalTime.push(performance.now() - startTime);
        return cachedResponse;
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    performanceMetrics.cacheMisses++;
    
    const cachedResponse = await getCachedResponse(request, cacheName, ttl);
    if (cachedResponse) {
      performanceMetrics.cacheHits++;
      performanceMetrics.cacheRetrievalTime.push(performance.now() - startTime);
      return cachedResponse;
    }
    
    throw error;
  }
}

// Cache First with Network Fallback (for static assets/images)
async function cacheFirstWithNetwork(request, cacheName, ttl) {
  const startTime = performance.now();
  
  const cachedResponse = await getCachedResponse(request, cacheName, ttl);
  if (cachedResponse) {
    performanceMetrics.cacheHits++;
    performanceMetrics.cacheRetrievalTime.push(performance.now() - startTime);
    return cachedResponse;
  }
  
  performanceMetrics.cacheMisses++;
  performanceMetrics.networkRequests++;
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      const responseToCache = networkResponse.clone();
      
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());
      
      const responseWithTime = new Response(await responseToCache.blob(), {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });
      
      cache.put(request, responseWithTime);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for:', request.url);
    throw error;
  }
}

// Stale While Revalidate (for dynamic content)
async function staleWhileRevalidate(request, cacheName) {
  const startTime = performance.now();
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());
      
      responseToCache.blob().then((blob) => {
        const responseWithTime = new Response(blob, {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: headers,
        });
        cache.put(request, responseWithTime);
      });
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  if (cachedResponse) {
    performanceMetrics.cacheHits++;
    performanceMetrics.cacheRetrievalTime.push(performance.now() - startTime);
    return cachedResponse;
  }
  
  performanceMetrics.cacheMisses++;
  return fetchPromise;
}

// Get cached response with TTL check
async function getCachedResponse(request, cacheName, ttl) {
  const cache = await caches.open(cacheName);
  const response = await cache.match(request);
  
  if (!response) return null;
  
  const cacheTime = response.headers.get('sw-cache-time');
  if (cacheTime && ttl) {
    const age = Date.now() - parseInt(cacheTime, 10);
    if (age > ttl) {
      // Cache expired, delete and return null
      await cache.delete(request);
      return null;
    }
  }
  
  return response;
}

// Message handler for cache control and metrics
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      // Updates stay in the waiting phase until the in-app prompt receives an
      // explicit Refresh now action. This preserves the incumbent worker and
      // its hashed-chunk cache for open clinical sessions that choose Later.
      event.waitUntil(self.skipWaiting());
      break;

    case 'GET_METRICS':
      event.ports[0]?.postMessage({
        ...performanceMetrics,
        averageRetrievalTime: performanceMetrics.cacheRetrievalTime.length > 0
          ? performanceMetrics.cacheRetrievalTime.reduce((a, b) => a + b, 0) / performanceMetrics.cacheRetrievalTime.length
          : 0,
        hitRate: performanceMetrics.cacheHits + performanceMetrics.cacheMisses > 0
          ? (performanceMetrics.cacheHits / (performanceMetrics.cacheHits + performanceMetrics.cacheMisses)) * 100
          : 0,
      });
      break;
      
    case 'CLEAR_CACHE':
      caches.keys().then((names) => {
        Promise.all(names.map((name) => caches.delete(name))).then(() => {
          event.ports[0]?.postMessage({ success: true });
        });
      });
      break;
      
    case 'CLEAR_API_CACHE':
    case 'CLEAR_SENSITIVE_CACHES':
      caches.keys().then((names) => {
        const sensitiveCaches = names.filter((name) =>
          name.startsWith('api-') || name.startsWith('dynamic-') || name.startsWith('images-')
        );
        Promise.all(sensitiveCaches.map((name) => caches.delete(name))).then(() => {
          event.ports[0]?.postMessage({ success: true });
        });
      });
      break;
      
    case 'PRECACHE_URLS':
      if (payload?.urls) {
        const safeUrls = payload.urls.filter((value) => {
          try {
            return !isSensitiveUrl(new URL(value, self.location.origin));
          } catch {
            return false;
          }
        });
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.addAll(safeUrls).then(() => {
            event.ports[0]?.postMessage({ success: true });
          });
        });
      }
      break;
      
    case 'RESET_METRICS':
      performanceMetrics.cacheHits = 0;
      performanceMetrics.cacheMisses = 0;
      performanceMetrics.networkRequests = 0;
      performanceMetrics.cacheRetrievalTime = [];
      event.ports[0]?.postMessage({ success: true });
      break;
  }
});
