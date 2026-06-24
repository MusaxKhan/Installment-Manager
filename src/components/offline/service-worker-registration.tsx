"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Registers the service worker once on mount. Mounted in the dashboard
 * layout alongside OfflineSyncProvider. Safe to call repeatedly —
 * the browser no-ops if already registered with the same script.
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
            }
          });
        });
      })
      .catch((err) => {
        console.error("Service worker registration failed:", err);
      });
  }, []);

  return null;
}
