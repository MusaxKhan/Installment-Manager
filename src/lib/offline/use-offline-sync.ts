"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { useOnlineStatus } from "./use-online-status";
import { syncOutbox } from "./sync-engine";
import { countPendingOperations } from "./outbox";
import { refreshOfflineCache } from "./cache-refresh";

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  /** Manually trigger a sync attempt (e.g. a "Sync now" button) */
  syncNow: () => Promise<void>;
}

/**
 * Mount once near the app root (in the dashboard layout). Handles:
 *  - Syncing the outbox automatically the moment connectivity returns
 *  - Refreshing the offline cache periodically while online, so the
 *    cache is never far behind when connectivity drops
 *  - Tracking pending-operation count for the UI badge
 */
export function useOfflineSync(): SyncState {
  const { isOnline } = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const wasOffline = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await countPendingOperations();
    setPendingCount(count);
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const { succeeded, failed } = await syncOutbox();
      if (succeeded > 0) {
        toast.success(
          `Synced ${succeeded} pending ${succeeded === 1 ? "change" : "changes"}.`
        );
      }
      if (failed > 0) {
        toast.error(
          `${failed} ${failed === 1 ? "change" : "changes"} couldn't sync — check the sync queue for details.`
        );
      }
      await refreshOfflineCache();
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Sync failed: ${err.message}`
          : "Sync failed unexpectedly."
      );
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [isSyncing, refreshPendingCount]);

  // Initial pending count on mount.
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Auto-sync the moment we transition from offline → online.
  useEffect(() => {
    if (isOnline && wasOffline.current) {
      syncNow();
    }
    wasOffline.current = !isOnline;
  }, [isOnline, syncNow]);

  // Periodic cache refresh + pending-count poll while online (every 2 min).
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => {
      refreshOfflineCache().catch(() => {
        // Silent — this is a background refresh, not a user action.
        // If it fails, the cache just stays at its last-known-good state.
      });
      refreshPendingCount();
    }, 120_000);
    return () => clearInterval(interval);
  }, [isOnline, refreshPendingCount]);

  return { isOnline, isSyncing, pendingCount, lastSyncedAt, syncNow };
}
