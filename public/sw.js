/**
 * Sitara Traders service worker.
 *
 * Scope of responsibility: make the APP SHELL (the HTML/JS/CSS bundle
 * itself, plus icons) available offline so the app can open with no
 * connection at all — not just "show stale data" but "actually load."
 *
 * Deliberately NOT caching:
 *  - API routes (/api/*) — these either need a live connection
 *    (sync endpoint) or are already handled by the Dexie offline layer,
 *    which is a purpose-built data cache with proper sync semantics.
 *    A service-worker HTTP cache sitting in front of /api/sync would
 *    risk serving a stale "success" response for a financial write,
 *    which is exactly the kind of subtle correctness bug this app
 *    can't afford.
 *  - Supabase requests — same reasoning, and they're cross-origin.
 *
 * IMPORTANT — Next.js App Router specifics: navigating between pages
 * you've already visited doesn't do a normal full-page load. Next
 * fetches an RSC payload via `fetch()` first and only falls back to a
 * real browser navigation if that fails outright. That means routes
 * not explicitly precached below (or visited at least once while
 * online, which caches them via the runtime cache-first handler) will
 * fail to open while offline, even with this service worker installed.
 * Pages that have an offline-capable client-side view (currently:
 * /dashboard, /clients, /contracts) are precached below so they always
 * work offline from a cold start. Pages with no offline equivalent
 * (e.g. /users, which needs a live connection to invite anyone) are
 * expected to fail offline — that's correct, not a bug — but they
 * should fail with the in-app "needs a connection" messaging, not a
 * blank screen, which is what the navigation fallback below is for.
 */

const CACHE_NAME = "sitara-shell-v2";

const SHELL_ASSETS = [
  "/",
  "/dashboard",
  "/clients",
  "/contracts",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept API calls or cross-origin requests (Supabase, etc).
  // These must always hit the network so write operations and auth
  // never get served from a cache.
  if (url.pathname.startsWith("/api/") || url.origin !== self.location.origin) {
    return;
  }

  // Only handle GET — writes always go straight to network.
  if (request.method !== "GET") {
    return;
  }

  // Navigation requests (loading a page/route): try network first for
  // freshness, fall back to a cached shell page if offline. We try the
  // exact requested path first (works for any route visited at least
  // once while online, since the runtime cache-first handler below
  // will have stored it), then /dashboard as the best general-purpose
  // shell, then "/" as a last resort.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match(request)
          .then((cached) => cached || caches.match("/dashboard"))
          .then((cached) => cached || caches.match("/"))
      )
    );
    return;
  }

  // Static assets (Next.js build output, fonts, icons): cache-first,
  // populate cache in the background on a hit so it self-heals after
  // a deploy without needing a full reinstall.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    request.destination === "font" ||
    request.destination === "image"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Any other same-origin GET (e.g. a page visited while online that
  // wasn't in the precache list, or its RSC payload fetch): cache it
  // opportunistically on a successful online response, so the *next*
  // time it's requested offline, the exact-path match above can serve
  // it instead of falling all the way back to /dashboard.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});