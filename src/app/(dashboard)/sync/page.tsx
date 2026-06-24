"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import {
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { offlineDb } from "@/lib/offline/db";
import { useOfflineSyncContext } from "@/lib/offline/offline-sync-context";
import { retryOutboxEntry, discardOutboxEntry } from "@/lib/offline/outbox";
import { formatDateTime } from "@/lib/utils/format";

const OPERATION_LABELS: Record<string, string> = {
  create_client: "New client",
  update_client: "Client update",
  create_contract: "New contract",
  record_payment: "Payment recorded",
};

export default function SyncPage() {
  const { isOnline, isSyncing, syncNow, lastSyncedAt } = useOfflineSyncContext();

  const entries = useLiveQuery(
    () =>
      offlineDb.outbox
        .orderBy("createdAt")
        .reverse()
        .toArray(),
    []
  );

  async function handleRetry(id: string) {
    await retryOutboxEntry(id);
    toast.info("Queued for retry.");
    if (isOnline) syncNow();
  }

  async function handleDiscard(id: string) {
    await discardOutboxEntry(id);
    toast.success("Discarded.");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Sync Queue
          </h1>
          <p className="text-sm text-muted-foreground">
            Changes made offline live here until they sync to the server.
          </p>
        </div>
        <Button onClick={syncNow} disabled={!isOnline || isSyncing} size="sm">
          <RefreshCw className={isSyncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {isSyncing ? "Syncing..." : "Sync Now"}
        </Button>
      </div>

      {!isOnline && (
        <Card className="border-status-overdue/40 bg-status-overdue-bg">
          <CardContent className="flex items-center gap-3 p-4">
            <CloudOff className="h-5 w-5 shrink-0 text-status-overdue" />
            <p className="text-sm text-foreground">
              You&apos;re currently offline. Anything queued here will sync
              automatically the moment you&apos;re back online.
            </p>
          </CardContent>
        </Card>
      )}

      {lastSyncedAt && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-status-completed" />
          Last synced {formatDateTime(lastSyncedAt)}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Queued Changes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!entries || entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CheckCircle2 className="h-8 w-8 text-status-completed" />
              <p className="text-sm text-muted-foreground">
                Nothing pending — everything&apos;s synced.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between gap-3 px-6 py-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {entry.status === "failed" ? (
                        <AlertTriangle className="h-4 w-4 text-status-overdue" />
                      ) : entry.status === "syncing" ? (
                        <RefreshCw className="h-4 w-4 animate-spin text-accent" />
                      ) : (
                        <Clock className="h-4 w-4 text-status-pending" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {OPERATION_LABELS[entry.type] ?? entry.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Queued {formatDateTime(entry.createdAt)}
                      </p>
                      {entry.lastError && (
                        <p className="mt-1 text-xs text-status-overdue">
                          {entry.lastError}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        entry.status === "failed"
                          ? "overdue"
                          : entry.status === "syncing"
                            ? "active"
                            : "pending"
                      }
                    >
                      {entry.status}
                    </Badge>
                    {entry.status === "failed" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRetry(entry.id)}
                          title="Retry"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-status-overdue"
                          onClick={() => handleDiscard(entry.id)}
                          title="Discard"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
