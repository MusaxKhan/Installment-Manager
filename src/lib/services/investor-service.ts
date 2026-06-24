import { createClient } from "@/lib/supabase/server";
import { mapInvestor } from "./mappers";
import { round2 } from "@/lib/utils/calculations";
import type { Investor, InvestorWithBalance } from "@/types/domain";
import type { InvestorFormValues } from "@/lib/validations/investor";

export class InvestorServiceError extends Error {}

export async function listInvestors(): Promise<Investor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investors")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new InvestorServiceError(`Failed to list investors: ${error.message}`);
  }
  return (data ?? []).map(mapInvestor);
}

/**
 * Lists investors with their full financial picture: total invested
 * (across all phases, all-time), total profit distributed to them,
 * total withdrawn, and the resulting available balance. This mirrors
 * exactly what `investor_available_balance()` computes in Postgres so
 * the UI and the withdrawal-validation guard never disagree.
 */
export async function listInvestorsWithBalances(): Promise<
  InvestorWithBalance[]
> {
  const supabase = await createClient();

  const [investorsRes, investmentsRes, distributionsRes, withdrawalsRes] =
    await Promise.all([
      supabase.from("investors").select("*").order("created_at", { ascending: false }),
      supabase.from("investor_phase_investments").select("investor_id, investment_amount"),
      supabase.from("profit_distributions").select("investor_id, profit_amount"),
      supabase.from("withdrawals").select("investor_id, amount"),
    ]);

  const firstError = [
    investorsRes,
    investmentsRes,
    distributionsRes,
    withdrawalsRes,
  ].find((r) => r.error)?.error;

  if (firstError) {
    throw new InvestorServiceError(
      `Failed to load investor balances: ${firstError.message}`
    );
  }

  const investedByInvestor = new Map<number, number>();
  for (const row of investmentsRes.data ?? []) {
    investedByInvestor.set(
      row.investor_id,
      (investedByInvestor.get(row.investor_id) ?? 0) + Number(row.investment_amount)
    );
  }

  const distributedByInvestor = new Map<number, number>();
  for (const row of distributionsRes.data ?? []) {
    if (row.investor_id === null) continue;
    distributedByInvestor.set(
      row.investor_id,
      (distributedByInvestor.get(row.investor_id) ?? 0) + Number(row.profit_amount)
    );
  }

  const withdrawnByInvestor = new Map<number, number>();
  for (const row of withdrawalsRes.data ?? []) {
    withdrawnByInvestor.set(
      row.investor_id,
      (withdrawnByInvestor.get(row.investor_id) ?? 0) + Number(row.amount)
    );
  }

  return (investorsRes.data ?? []).map((row) => {
    const investor = mapInvestor(row);
    const totalInvested = investedByInvestor.get(row.id) ?? 0;
    const totalDistributed = distributedByInvestor.get(row.id) ?? 0;
    const totalWithdrawn = withdrawnByInvestor.get(row.id) ?? 0;

    return {
      ...investor,
      totalInvested,
      totalDistributed,
      totalWithdrawn,
      availableBalance: round2(totalDistributed - totalWithdrawn),
    };
  });
}

export async function getInvestorWithBalance(
  id: number
): Promise<InvestorWithBalance | null> {
  const all = await listInvestorsWithBalances();
  return all.find((i) => i.id === id) ?? null;
}

export async function createInvestorRecord(
  values: InvestorFormValues
): Promise<Investor> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("investors")
    .insert({ name: values.name, active: values.active })
    .select("*")
    .single();

  if (error) {
    throw new InvestorServiceError(
      `Failed to create investor: ${error.message}`
    );
  }
  return mapInvestor(data);
}

export async function updateInvestorRecord(
  id: number,
  values: InvestorFormValues
): Promise<Investor> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("investors")
    .update({ name: values.name, active: values.active })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new InvestorServiceError(
      `Failed to update investor: ${error.message}`
    );
  }
  return mapInvestor(data);
}

/**
 * Investors with any investment, distribution, or withdrawal history
 * cannot be deleted outright — that would orphan financial records.
 * Deactivating (active=false) is the supported way to retire an investor.
 */
export async function deleteInvestorRecord(id: number): Promise<void> {
  const supabase = await createClient();

  const [investmentsCount, distributionsCount, withdrawalsCount] =
    await Promise.all([
      supabase
        .from("investor_phase_investments")
        .select("id", { count: "exact", head: true })
        .eq("investor_id", id),
      supabase
        .from("profit_distributions")
        .select("id", { count: "exact", head: true })
        .eq("investor_id", id),
      supabase
        .from("withdrawals")
        .select("id", { count: "exact", head: true })
        .eq("investor_id", id),
    ]);

  const hasHistory =
    (investmentsCount.count ?? 0) > 0 ||
    (distributionsCount.count ?? 0) > 0 ||
    (withdrawalsCount.count ?? 0) > 0;

  if (hasHistory) {
    throw new InvestorServiceError(
      "This investor has investment, distribution, or withdrawal history and can't be deleted. Mark them inactive instead."
    );
  }

  const { error } = await supabase.from("investors").delete().eq("id", id);
  if (error) {
    throw new InvestorServiceError(
      `Failed to delete investor: ${error.message}`
    );
  }
}

export async function getInvestorPhaseHistory(investorId: number): Promise<
  { phaseId: number; phaseName: string; phaseStatus: string; investmentAmount: number }[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("investor_phase_investments")
    .select("phase_id, investment_amount, phase:business_phases(phase_name, status)")
    .eq("investor_id", investorId)
    .order("phase_id", { ascending: false });

  if (error) {
    throw new InvestorServiceError(
      `Failed to load investor phase history: ${error.message}`
    );
  }

  return (data ?? []).map((row) => ({
    phaseId: row.phase_id,
    phaseName: row.phase?.phase_name ?? "Unknown phase",
    phaseStatus: row.phase?.status ?? "CLOSED",
    investmentAmount: Number(row.investment_amount),
  }));
}
