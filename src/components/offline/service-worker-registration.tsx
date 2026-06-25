"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * The pages this app can meaningfully render offline (see sw.js for the
 * full reasoning). Kept in sync with SHELL_ASSETS in public/sw.js —
 * if you add another offline-capable page there, add it here too.
 */
const OFFLINE_CAPABLE_PAGES = ["/dashboard", "/clients", "/contracts"];

/**
 * Fetches a page's real HTML and pulls out every same-origin
 * `<script src="...">` URL referenced in it — these are the actual,
 * currently-deployed, content-hashed chunk filenames for that route.
 *
 * This is necessary because Next.js's chunk filenames are hashed per
 * build and aren't knowable ahead of time. There's no public,
 * web-accessible manifest that maps routes to chunks (app-build-manifest.json
 * is a build-time-only file the Next.js server reads internally — it
 * 404s if requested over HTTP). The page's own rendered HTML is the
 * only reliable, always-available source of truth for "what does this
 * exact build need to run this route."
 */
async function getScriptUrlsForPage(path: string): Promise<string[]> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) return [];

  const html = await response.text();
  const urls = new Set<string>();
  const scriptTagPattern = /<script[^>]+src="([^"]+)"/g;

  let match: RegExpExecArray | null;
  while ((match = scriptTagPattern.exec(html)) !== null) {
    const src = match[1];
    if (src.startsWith("/_next/")) {
      urls.add(src);
    }
  }
  return Array.from(urls);
}

/**
 * Registers the service worker once on mount. Mounted in the dashboard
 * layout alongside OfflineSyncProvider. Safe to call repeatedly —
 * the browser no-ops if already registered with the same script.
 *
 * After activation, explicitly fetches each offline-capable page AND
 * every JS chunk it references, so the static-asset cache-first
 * handler in sw.js has actually stored them before anyone goes
 * offline. Without this warm-up, a person who deploys a new build and
 * goes offline before ever opening (say) /clients on that exact build
 * hits a cache miss + network failure for its chunk — that's the
 * ChunkLoadError this exists to prevent.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      // Skip in dev — Next's dev server constantly recompiles, and a
      // stale SW caching half-built assets makes local development
      // confusing. Production builds are stable, versioned bundles.
      return;
    }

    async function warmShellCache() {
      for (const path of OFFLINE_CAPABLE_PAGES) {
        try {
          const scriptUrls = await getScriptUrlsForPage(path);
          // Fire these through fetch() so the service worker's own
          // fetch handler intercepts and caches them as a side effect
          // — same mechanism as a real page load, just without
          // rendering anything.
          await Promise.allSettled(
            scriptUrls.map((url) => fetch(url, { cache: "no-store" }))
          );
        } catch {
          // Best-effort warm-up — a failure here just means that page
          // falls back to the generic /dashboard shell if opened cold
          // offline later, not a broken app.
        }
      }
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              toast.info("An update is ready — refresh to get the latest version.", {
                duration: 10000,
              });
              // A new build just installed — re-warm so its chunks are
              // cached too, not just the previous build's.
              warmShellCache();
            }
          });
        });

        // Wait for the SW to actually be in control before warming —
        // otherwise these first fetches bypass it entirely and nothing
        // gets cached.
        if (navigator.serviceWorker.controller) {
          warmShellCache();
        } else {
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => warmShellCache(),
            { once: true }
          );
        }
      })
      .catch((err) => {
        console.error("Service worker registration failed:", err);
      });
  }, []);

  return null;
}