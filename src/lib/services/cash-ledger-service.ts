import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export class CashLedgerServiceError extends Error {}

export type CashLedgerEntryType =
  | "investment"
  | "loan"
  | "payment_received"
  | "purchase"
  | "withdrawal"
  | "loan_repayment";

export interface CashLedgerEntry {
  id: number;
  entryType: CashLedgerEntryType;
  amount: number;
  contractId: number | null;
  investorId: number | null;
  investmentId: number | null;
  loanId: number | null;
  withdrawalId: number | null;
  description: string | null;
  entryDate: string;
  createdAt: string;
}

/**
 * Writes one cash_ledger row. This is a thin, shared helper rather
 * than ad-hoc inserts scattered across contract-service.ts,
 * payment-service.ts, etc. — every place that moves cash calls this
 * exact function, so there's one place to look if the ledger ever
 * looks wrong.
 *
 * Takes an already-created Supabase client (rather than creating its
 * own) so callers can write the ledger entry as part of the same
 * request lifecycle as the operation that triggered it.
 */
export async function writeCashLedgerEntry(
  supabase: SupabaseClient<Database>,
  entry: {
    entryType: CashLedgerEntryType;
    amount: number;
    contractId?: number;
    investorId?: number;
    investmentId?: number;
    loanId?: number;
    withdrawalId?: number;
    description?: string;
    entryDate?: string;
  }
): Promise<void> {
  const { error } = await supabase.from("cash_ledger").insert({
    entry_type: entry.entryType,
    amount: entry.amount,
    contract_id: entry.contractId ?? null,
    investor_id: entry.investorId ?? null,
    investment_id: entry.investmentId ?? null,
    loan_id: entry.loanId ?? null,
    withdrawal_id: entry.withdrawalId ?? null,
    description: entry.description ?? null,
    entry_date: entry.entryDate ?? new Date().toISOString().split("T")[0],
  });

  if (error) {
    throw new CashLedgerServiceError(
      `Failed to write cash ledger entry: ${error.message}`
    );
  }
}

export async function getCashInHand(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_cash_in_hand");

  if (error) {
    throw new CashLedgerServiceError(
      `Failed to fetch cash in hand: ${error.message}`
    );
  }

  return Number(data ?? 0);
}

export async function listCashLedgerEntries(params?: {
  limit?: number;
}): Promise<CashLedgerEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cash_ledger")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(params?.limit ?? 200);

  if (error) {
    throw new CashLedgerServiceError(
      `Failed to list cash ledger entries: ${error.message}`
    );
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    entryType: row.entry_type as CashLedgerEntryType,
    amount: Number(row.amount),
    contractId: row.contract_id,
    investorId: row.investor_id,
    investmentId: row.investment_id,
    loanId: row.loan_id,
    withdrawalId: row.withdrawal_id,
    description: row.description,
    entryDate: row.entry_date,
    createdAt: row.created_at,
  }));
}