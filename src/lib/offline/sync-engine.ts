"use client";

import { offlineDb, type OutboxEntry } from "./db";
import {
  markOutboxEntrySyncing,
  markOutboxEntryFailed,
  removeOutboxEntry,
} from "./outbox";

export interface SyncResult {
  entryId: string;
  success: boolean;
  error?: string;
  warning?: string;
}

/**
 * Drains the outbox: processes pending entries one at a time, in the
 * order they were created (oldest first), against /api/sync.
 *
 * Sequential, not parallel — deliberately. If someone created a client
 * offline and then a contract for that client offline (in that order),
 * the client must sync and get its real server-side ID before the
 * contract sync call can reference it correctly.
 *
 * Temp-ID resolution: an offline-created client is cached locally
 * under a negative placeholder ID (see ClientForm) so it's immediately
 * selectable elsewhere in the app (e.g. the contract form's client
 * picker) before it has actually synced. If a contract was created
 * referencing that placeholder, its outbox entry carries the same
 * negative number as `clientId`. Once the client's own outbox entry
 * syncs successfully and we learn its real ID, we rewrite every
 * not-yet-synced contract entry that referenced the placeholder to
 * point at the real ID — tempIdMap below is what makes that rewrite
 * possible without needing a persisted dependency graph.
 *
 * An entry is only removed from the outbox after the server confirms
 * success. A failure leaves it in the queue (marked "failed", with the
 * error message attached) so the person can see what went wrong and
 * decide whether to retry or discard it — it never just disappears.
 */
export async function syncOutbox(
  onProgress?: (result: SyncResult) => void
): Promise<{ succeeded: number; failed: number }> {
  const entries = await offlineDb.outbox
    .where("status")
    .anyOf("pending", "failed")
    .toArray();

  entries.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Maps a negative local temp client ID -> the real server-assigned ID,
  // populated as create_client entries successfully sync during this run.
  const tempIdMap = new Map<number, number>();

  let succeeded = 0;
  let failed = 0;

  for (const entry of entries) {
    // If this entry depends on a client that's still pending (negative
    // clientId not yet in tempIdMap and still present in the outbox),
    // skip it for this pass — it'll be picked up on the next sync run
    // once its dependency has cleared. This can only happen if the
    // dependency itself failed to sync in this same pass.
    if (entry.type === "create_contract") {
      const clientId = entry.payload.clientId;
      if (typeof clientId === "number" && clientId < 0) {
        const resolved = tempIdMap.get(clientId);
        if (resolved === undefined) {
          const dependencyStillPending = entries.some(
            (e) => e.type === "create_client" && e.localTempId === clientId
          );
          if (dependencyStillPending) {
            // Leave it queued (still "pending"/"failed") — don't touch it.
            continue;
          }
        } else {
          entry.payload = { ...entry.payload, clientId: resolved };
        }
      }
    }

    const result = await syncSingleEntry(entry);

    if (result.success) {
      succeeded += 1;

      if (
        entry.type === "create_client" &&
        entry.localTempId !== undefined &&
        result.realId
      ) {
        tempIdMap.set(entry.localTempId, result.realId);
        // Replace the optimistic negative-ID cache row with the real one.
        await offlineDb.clients.delete(entry.localTempId);
      }

      await removeOutboxEntry(entry.id);
    } else {
      failed += 1;
      await markOutboxEntryFailed(entry.id, result.error ?? "Unknown error");
    }
    onProgress?.(result);
  }

  return { succeeded, failed };
}

async function syncSingleEntry(
  entry: OutboxEntry
): Promise<SyncResult & { realId?: number }> {
  await markOutboxEntrySyncing(entry.id);

  try {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: entry.type,
        payload: entry.payload,
        clientUpdateId:
          entry.type === "update_client" ? entry.payload.id : undefined,
        contractUpdateId:
          entry.type === "update_contract"
            ? entry.payload.contractId
            : undefined,
      }),
    });

    const json = await response.json().catch(() => null);

    if (!response.ok || !json?.success) {
      return {
        entryId: entry.id,
        success: false,
        error: json?.error ?? `Sync failed with status ${response.status}.`,
      };
    }

    return {
      entryId: entry.id,
      success: true,
      warning: json.warning,
      realId: typeof json.data?.id === "number" ? json.data.id : undefined,
    };
  } catch (err) {
    return {
      entryId: entry.id,
      success: false,
      error:
        err instanceof Error
          ? `Network error while syncing: ${err.message}`
          : "Unknown network error while syncing.",
    };
  }
}