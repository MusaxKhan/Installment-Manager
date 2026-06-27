import Dexie, { type Table } from "dexie";

/**
 * Local offline database for Sitara Traders.
 *
 * Design principle: this is a CACHE + OUTBOX, not a second source of
 * truth. Reads come from here when offline (or to avoid a network
 * round-trip when online). Writes go into `outbox` and are replayed
 * against Supabase when connectivity returns — they are NEVER trusted
 * as final until the server has accepted and re-validated them.
 *
 * Money-critical operations (profit distribution, withdrawals) are
 * deliberately NOT queueable here — see lib/offline/guards.ts. Those
 * rely on atomic, row-locked Postgres functions that only make sense
 * with a live connection; queuing them offline would silently defeat
 * the locking that prevents double-distribution/double-withdrawal.
 */

// ── Cached read models (denormalized just enough for offline browsing) ──

export interface CachedClient {
  id: number;
  clientCode: string;
  name: string;
  cnic: string | null;
  phone: string | null;
  address: string | null;
  isDeleted: boolean;
  updatedAt: string;
  syncVersion: number;
}

export interface CachedContract {
  id: number;
  contractCode: string;
  clientId: number;
  clientName: string;
  productName: string;
  productDescription: string | null;
  initiatedBy: string;
  purchasePrice: number;
  profitPercent: number;
  profitAmount: number;
  totalPrice: number;
  numberOfInstallments: number;
  amountPerInstallment: number;
  remainingBalance: number;
  startDate: string;
  expectedEndDate: string | null;
  status: "ACTIVE" | "COMPLETED" | "OVERDUE";
  overdueMonths: number;
  profitDistributed: boolean;
  guarantorName: string | null;
  guarantorPhone: string | null;
  guarantorAddress: string | null;
  guarantorCnic: string | null;
  updatedAt: string;
  syncVersion: number;
}

export interface CachedInstallment {
  id: number;
  contractId: number;
  installmentNumber: number;
  dueDate: string;
  installmentAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  updatedAt: string;
}

export interface CachedPayment {
  id: number;
  contractId: number;
  amountPaid: number;
  remainingBalance: number;
  paymentMethod: string | null;
  remarks: string | null;
  paymentDate: string;
  updatedAt: string;
  syncVersion: number;
  /** True if this row only exists locally and hasn't synced yet */
  isPendingSync?: boolean;
}

// ── Outbox: queued writes waiting to sync ──

export type OutboxOperationType =
  | "create_client"
  | "update_client"
  | "create_contract"
  | "update_contract"
  | "record_payment";

export type OutboxStatus = "pending" | "syncing" | "failed";

export interface OutboxEntry {
  /** Client-generated UUID — also used as the idempotency key server-side */
  id: string;
  type: OutboxOperationType;
  payload: Record<string, unknown>;
  createdAt: string;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  /**
   * For operations the UI needs to reference before they've synced
   * (e.g. "record a payment against the contract I just created
   * offline"), this holds the temporary negative local ID so dependent
   * outbox entries can be linked and resolved together at sync time.
   */
  localTempId?: number;
}

class SitaraOfflineDB extends Dexie {
  clients!: Table<CachedClient, number>;
  contracts!: Table<CachedContract, number>;
  installments!: Table<CachedInstallment, number>;
  payments!: Table<CachedPayment, number>;
  outbox!: Table<OutboxEntry, string>;

  constructor() {
    super("sitara-traders-offline");

    this.version(1).stores({
      clients: "id, clientCode, name, cnic, phone, isDeleted, updatedAt",
      contracts:
        "id, contractCode, clientId, status, profitDistributed, updatedAt",
      installments: "id, contractId, status, dueDate",
      payments: "id, contractId, paymentDate, isPendingSync",
      outbox: "id, type, status, createdAt",
    });
  }
}

export const offlineDb = new SitaraOfflineDB();