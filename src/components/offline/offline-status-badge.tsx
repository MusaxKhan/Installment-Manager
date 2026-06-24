"use client";

import Link from "next/link";
import { WifiOff, RefreshCw, CloudOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOfflineSyncContext } from "@/lib/offline/offline-sync-context";
import { cn } from "@/lib/utils";

export function OfflineStatusBadge() {
  const { isOnline, isSyncing, pendingCount } = useOfflineSyncContext();

  if (isOnline && pendingCount === 0 && !isSyncing) {
    // Nothing worth showing — fully synced and online.
    return null;
  }

  return (
    <Link href="/sync">
      <Badge
        variant={isOnline ? "partial" : "overdue"}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 cursor-pointer",
          isSyncing && "animate-pulse"
        )}
      >
        {!isOnline ? (
          <>
            <WifiOff className="h-3.5 w-3.5" />
            Offline
            {pendingCount > 0 && ` · ${pendingCount} pending`}
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Syncing...
          </>
        ) : (
          <>
            <CloudOff className="h-3.5 w-3.5" />
            {pendingCount} pending sync
          </>
        )}
      </Badge>
    </Link>
  );
}
