"use client";

import * as React from "react";
import { useOfflineSync, type SyncState } from "@/lib/offline/use-offline-sync";

const OfflineSyncContext = React.createContext<SyncState | null>(null);

/**
 * Single shared instance of useOfflineSync for the whole app. Mount
 * once at the dashboard layout root. Components that need sync state
 * (the status badge, the sync queue page) read it via
 * useOfflineSyncContext() instead of each calling useOfflineSync()
 * directly — that would create independent intervals/listeners per
 * component and risk overlapping sync attempts.
 */
export function OfflineSyncRoot({ children }: { children: React.ReactNode }) {
  const syncState = useOfflineSync();
  return (
    <OfflineSyncContext.Provider value={syncState}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSyncContext(): SyncState {
  const ctx = React.useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error(
      "useOfflineSyncContext must be used within OfflineSyncRoot"
    );
  }
  return ctx;
}
