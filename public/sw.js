/*
  Service Worker for Space Invaders
  Cache strategy summary:
  - Navigations (HTML): network-first to avoid stale app shell
  - Next.js build assets under /_next/: stale-while-revalidate (hashed, safe to cache)
  - Images/Audio/Fonts: cache-first
  - Others: stale-while-revalidate
  Extra:
  - Bumped cache name to force upgrade when this file changes
  - CLEAR_CACHE message to purge caches on demand
  - SKIP_WAITING support to activate immediately
*/

const CACHE_NAME = "alien-invasion-v3";

// Keep '/' out of precache to avoid serving stale HTML
const PRECACHE_URLS = [
  // Core static assets used by the game
  "/hulk.png",
  "/fighterjet.png",
  // Audio (filenames include spaces – keep exact casing)
  "/bullet.mp3",
  "/mega blast.mp3",
  "/game over.mp3",
  // Game script
  "/main.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clear old versioned caches
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return undefined;
        })
      );
      await self.clients.claim();
    })()
  );
});

function isNavigationRequest(request) {
  return (
    request.mode === "navigate" ||
    (request.destination === "" &&
      request.headers.get("accept")?.includes("text/html"))
  );
}

function cacheFirst(event) {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
}

function staleWhileRevalidate(event) {
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      const fetchPromise = fetch(event.request)
        .then((response) => {
          cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })()
  );
}

function networkFirst(event) {
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch (_) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Optional offline fallback: try app shell
        const fallback = await caches.match("/");
        return fallback || Response.error();
      }
    })()
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Navigation requests (HTML): network-first
  if (isNavigationRequest(request)) {
    return networkFirst(event);
  }

  // Next.js build assets: stale-while-revalidate
  if (url.pathname.startsWith("/_next/")) {
    return staleWhileRevalidate(event);
  }

  // Static assets by destination
  const dest = request.destination;
  if (dest === "image" || dest === "audio" || dest === "font") {
    return cacheFirst(event);
  }

  // Default: stale-while-revalidate
  return staleWhileRevalidate(event);
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;
  if (
    data === "CLEAR_CACHE" ||
    (typeof data === "object" && data.type === "CLEAR_CACHE")
  ) {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      })()
    );
  }
  if (
    data === "SKIP_WAITING" ||
    (typeof data === "object" && data.type === "SKIP_WAITING")
  ) {
    self.skipWaiting();
  }
});
