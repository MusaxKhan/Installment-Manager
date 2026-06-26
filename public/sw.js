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
 * online, which caches them via the runtime catch-all handler near
 * the bottom of this file) will fail to open while offline, even with
 * this service worker installed.
 *
 * KEEP IN SYNC with OFFLINE_CAPABLE_STATIC_ROUTES in
 * src/lib/offline/offline-routes.ts — this file can't import that
 * one (service workers run unbundled, outside webpack), so the list
 * below is a manually maintained copy. Dynamic routes (/contracts/[id])
 * aren't listed here because they can't be precached generically —
 * service-worker-registration.tsx separately warms whichever specific
 * contracts are already in the Dexie cache, and the catch-all fetch
 * handler below opportunistically caches any contract page actually
 * visited while online, so most real usage ends up cached anyway.
 */

const CACHE_NAME = "sitara-shell-v4";

const SHELL_ASSETS = [
  "/",
  "/dashboard",
  "/clients",
  "/clients/new",
  "/contracts",
  "/contracts/new",
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
  // freshness. If that fails (offline), try the exact requested path
  // from cache first — this is what makes a specific contract page
  // work offline if it was ever visited online or pre-warmed. If that
  // specific page was never cached, fall back to /dashboard as a
  // working shell rather than a browser error, and "/" as a last resort.
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
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => {
            // Offline and this exact chunk was never cached (e.g. the
            // build changed since this device last cached the shell).
            // There's nothing useful to return for a JS chunk — but we
            // must resolve, not reject, or the browser surfaces an
            // unhandled rejection and the page's script loading breaks
            // instead of just that one feature being unavailable.
            return new Response(
              "/* offline: this build asset was not cached */",
              { status: 503, statusText: "Offline", headers: { "Content-Type": "text/javascript" } }
            );
          });
      })
    );
    return;
  }

  // Any other same-origin GET (e.g. a page visited while online that
  // wasn't in the precache list, or its RSC payload fetch): cache it
  // opportunistically on a successful online response, so the *next*
  // time it's requested offline, the exact-path match above can serve
  // it instead of falling all the way back to /dashboard. This is what
  // makes individual /contracts/[id] pages work offline after having
  // been opened at least once while online.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ||
            new Response(null, { status: 504, statusText: "Offline — not cached" })
        )
      )
  );
});