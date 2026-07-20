"use client";

import { offlineDb } from "./db";
import { getOfflineSnapshot } from "@/lib/actions/offline-snapshot-actions";

/**
 * Pulls a fresh snapshot from the server and writes it into the local
 * Dexie cache. Call this whenever the app comes online, and on a
 * regular interval while online, so the offline cache is never too
 * stale when connectivity actually drops.
 *
 * Uses bulkPut (upsert by primary key) rather than clearing the table
 * first — if the snapshot fetch is interrupted partway, we don't want
 * to have wiped the existing cache for no replacement.
 */
export async function refreshOfflineCache(): Promise<{
  clientCount: number;
  contractCount: number;
}> {
  const snapshot = await getOfflineSnapshot();

  await offlineDb.transaction(
    "rw",
    [offlineDb.clients, offlineDb.contracts, offlineDb.installments, offlineDb.payments],
    async () => {
      await offlineDb.clients.bulkPut(snapshot.clients);
      await offlineDb.contracts.bulkPut(snapshot.contracts);
      await offlineDb.installments.bulkPut(snapshot.installments);

      // Local pending (not-yet-synced) payments must survive a refresh —
      // only overwrite payments the server actually knows about.
      const serverPaymentIds = new Set(snapshot.payments.map((p) => p.id));
      const existingPending = await offlineDb.payments
        .filter((p) => p.isPendingSync === true && !serverPaymentIds.has(p.id))
        .toArray();

      await offlineDb.payments.bulkPut(snapshot.payments);
      if (existingPending.length > 0) {
        await offlineDb.payments.bulkPut(existingPending);
      }

      // bulkPut is an upsert — it can refresh a row but can never tell
      // Dexie "this id no longer exists". Contracts are hard-deleted
      // (see delete_contract() in supabase/sql/004_contract_deletion.sql),
      // so without this the deleted contract — and its installments/
      // payments — would linger in the offline cache forever and keep
      // showing up while browsing offline.
      if (snapshot.deletedContractIds.length > 0) {
        await offlineDb.contracts.bulkDelete(snapshot.deletedContractIds);
        await offlineDb.installments
          .where("contractId")
          .anyOf(snapshot.deletedContractIds)
          .delete();
        // Leave pending (not-yet-synced) payments alone even for a
        // deleted contract — the sync engine, not this refresh, is
        // responsible for surfacing that conflict when it tries to
        // push them.
        await offlineDb.payments
          .where("contractId")
          .anyOf(snapshot.deletedContractIds)
          .and((p) => p.isPendingSync !== true)
          .delete();
      }
    }
  );

  return {
    clientCount: snapshot.clients.length,
    contractCount: snapshot.contracts.length,
  };
}