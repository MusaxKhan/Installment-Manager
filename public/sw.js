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
 * Strategy: cache-first for the precached shell assets (instant load,
 * they're versioned by the CACHE_NAME below so a deploy invalidates
 * them), network-first with shell fallback for navigation requests
 * (so a person opening a fresh URL offline still gets the app shell
 * rather than a browser error page, and the router takes it from there
 * using cached Dexie data).
 */

const CACHE_NAME = "sitara-shell-v1";

const SHELL_ASSETS = [
  "/",
  "/dashboard",
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
  // freshness, fall back to the cached app shell root if offline so
  // the app at least opens — client-side routing + Dexie take it from
  // there for actual content.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/dashboard").then((cached) => cached || caches.match("/"))
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
  }
});
