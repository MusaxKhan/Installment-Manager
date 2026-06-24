import { offlineDb, type OutboxEntry, type OutboxOperationType } from "./db";

/**
 * Adds an operation to the outbox queue. Called by offline-capable
 * forms when a write is attempted with no connection. Returns the
 * generated entry id so the caller can show a "pending sync" reference.
 */
export async function enqueueOperation(
  type: OutboxOperationType,
  payload: Record<string, unknown>,
  localTempId?: number
): Promise<string> {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const entry: OutboxEntry = {
    id,
    type,
    payload,
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
    lastError: null,
    localTempId,
  };

  await offlineDb.outbox.add(entry);
  return id;
}

export async function listPendingOperations(): Promise<OutboxEntry[]> {
  return offlineDb.outbox
    .where("status")
    .anyOf("pending", "syncing", "failed")
    .toArray();
}

export async function countPendingOperations(): Promise<number> {
  return offlineDb.outbox
    .where("status")
    .anyOf("pending", "syncing", "failed")
    .count();
}

export async function removeOutboxEntry(id: string): Promise<void> {
  await offlineDb.outbox.delete(id);
}

export async function markOutboxEntryFailed(
  id: string,
  error: string
): Promise<void> {
  const entry = await offlineDb.outbox.get(id);
  if (!entry) return;
  await offlineDb.outbox.update(id, {
    status: "failed",
    attempts: entry.attempts + 1,
    lastError: error,
  });
}

export async function markOutboxEntrySyncing(id: string): Promise<void> {
  await offlineDb.outbox.update(id, { status: "syncing" });
}

/** Lets a person retry a failed entry (e.g. after fixing a validation issue) */
export async function retryOutboxEntry(id: string): Promise<void> {
  await offlineDb.outbox.update(id, { status: "pending", lastError: null });
}

/** Discards a failed entry the person has decided to abandon */
export async function discardOutboxEntry(id: string): Promise<void> {
  await offlineDb.outbox.delete(id);
}
