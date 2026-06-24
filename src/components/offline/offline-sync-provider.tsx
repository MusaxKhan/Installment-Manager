"use client";

import * as React from "react";
import { OfflineSyncRoot, useOfflineSyncContext } from "@/lib/offline/offline-sync-context";
import { refreshOfflineCache } from "@/lib/offline/cache-refresh";

function CacheWarmer() {
  const { isOnline } = useOfflineSyncContext();
  const hasWarmedCache = React.useRef(false);

  React.useEffect(() => {
    if (isOnline && !hasWarmedCache.current) {
      hasWarmedCache.current = true;
      refreshOfflineCache().catch(() => {
        // Non-fatal — if this fails, the cache just stays empty/stale
        // until the next periodic refresh succeeds.
      });
    }
  }, [isOnline]);

  return null;
}

/**
 * Mount once near the root of the authenticated app shell. Provides
 * the single shared offline-sync state instance (auto-sync on
 * reconnect, periodic cache refresh, pending count) to every
 * descendant via context, and warms the local cache on first load.
 */
export function OfflineSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OfflineSyncRoot>
      <CacheWarmer />
      {children}
    </OfflineSyncRoot>
  );
}
