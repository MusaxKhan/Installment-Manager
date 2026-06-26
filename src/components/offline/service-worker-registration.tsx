"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { OFFLINE_CAPABLE_STATIC_ROUTES } from "@/lib/offline/offline-routes";
import { offlineDb } from "@/lib/offline/db";

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
async function warmPage(path: string): Promise<void> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) return;

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

  await Promise.allSettled(
    Array.from(urls).map((url) => fetch(url, { cache: "no-store" }))
  );
}

/**
 * Registers the service worker once on mount. Mounted in the dashboard
 * layout alongside OfflineSyncProvider. Safe to call repeatedly —
 * the browser no-ops if already registered with the same script.
 *
 * After activation, explicitly fetches every statically offline-capable
 * page (OFFLINE_CAPABLE_STATIC_ROUTES) AND every JS chunk each one
 * references, so the static-asset cache-first handler in sw.js has
 * actually stored them before anyone goes offline. Without this
 * warm-up, a person who deploys a new build and goes offline before
 * ever opening (say) /clients/new on that exact build hits a cache
 * miss + network failure for its chunk.
 *
 * It also separately warms the detail page for every contract
 * currently in the Dexie cache. /contracts/[id] is a dynamic route —
 * it can't be listed in OFFLINE_CAPABLE_STATIC_ROUTES because there's
 * no fixed set of URLs to precache. Instead, since the Dexie cache
 * already tracks "which contracts has this person actually worked
 * with recently," warming exactly those contract pages means Record
 * Payment stays reachable offline for any contract that shows up in
 * the offline contracts list — which is the only place a person could
 * navigate to one from while offline anyway.
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
      for (const path of OFFLINE_CAPABLE_STATIC_ROUTES) {
        try {
          await warmPage(path);
        } catch {
          // Best-effort warm-up — a failure here just means that page
          // falls back to the generic /dashboard shell if opened cold
          // offline later, not a broken app.
        }
      }

      try {
        const cachedContracts = await offlineDb.contracts.toArray();
        // Cap how many we warm in one pass — a shop with a large
        // contract history shouldn't make every reconnect fire off
        // hundreds of fetches. Most recently updated first, since
        // those are the ones most likely to be opened next.
        const toWarm = cachedContracts
          .filter((c) => c.id > 0) // skip any optimistic/pending negative-id rows
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
          .slice(0, 100);

        for (const contract of toWarm) {
          try {
            await warmPage(`/contracts/${contract.id}`);
          } catch {
            // Same best-effort reasoning as above, per-contract.
          }
        }
      } catch {
        // Dexie not ready yet or otherwise unavailable — non-fatal,
        // the static routes above already warmed successfully.
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