import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { getCashInHand } from "./cash-ledger-service";
import { getTotalOutstandingLoans } from "./loan-service";
import type { DashboardStats } from "@/types/domain";

export class DashboardServiceError extends Error {}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const [
    activeContractsRes,
    overdueContractsRes,
    completedContractsRes,
    clientsRes,
    investorsRes,
    remainingBalanceRows,
    completedContractsProfitRows,
    distributionsRows,
    activePhaseRes,
    cashInHand,
    totalOutstandingLoans,
  ] = await Promise.all([
    supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE"),
    supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("status", "OVERDUE"),
    supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("status", "COMPLETED"),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("is_deleted", false),
    supabase
      .from("investors")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    // These four feed SUMs computed in JS below, so unlike the counts
    // above they can't rely on a head:true count — they need every
    // matching row, which means they need to be paginated around
    // whatever max_rows is set to, or the totals silently understate
    // reality once a table crosses that row count.
    fetchAllRows<{ remaining_balance: number }>((from, to) =>
      supabase
        .from("contracts")
        .select("remaining_balance")
        .in("status", ["ACTIVE", "OVERDUE"])
        .range(from, to)
    ),
    fetchAllRows<{ profit_amount: number }>((from, to) =>
      supabase
        .from("contracts")
        .select("profit_amount")
        .eq("status", "COMPLETED")
        .range(from, to)
    ),
    fetchAllRows<{ profit_amount: number }>((from, to) =>
      supabase.from("profit_distributions").select("profit_amount").range(from, to)
    ),
    supabase
      .from("business_phases")
      .select("id")
      .eq("status", "ACTIVE")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getCashInHand(),
    getTotalOutstandingLoans(),
  ]);

  const firstError = [
    activeContractsRes,
    overdueContractsRes,
    completedContractsRes,
    clientsRes,
    investorsRes,
    activePhaseRes,
  ].find((r) => r.error)?.error;

  if (firstError) {
    throw new DashboardServiceError(
      `Failed to load dashboard stats: ${firstError.message}`
    );
  }

  const totalOutstandingAmount = remainingBalanceRows.reduce(
    (sum, c) => sum + Number(c.remaining_balance),
    0
  );

  const totalProfitGenerated = completedContractsProfitRows.reduce(
    (sum, c) => sum + Number(c.profit_amount),
    0
  );

  const totalProfitDistributed = distributionsRows.reduce(
    (sum, d) => sum + Number(d.profit_amount),
    0
  );

  let activePhaseInvestmentTotal = 0;
  if (activePhaseRes.data?.id) {
    const investments = await fetchAllRows<{ investment_amount: number }>(
      (from, to) =>
        supabase
          .from("investor_phase_investments")
          .select("investment_amount")
          .eq("phase_id", activePhaseRes.data!.id)
          .range(from, to)
    ).catch((err) => {
      throw new DashboardServiceError(
        `Failed to load active phase investment total: ${err.message}`
      );
    });

    activePhaseInvestmentTotal = investments.reduce(
      (sum, i) => sum + Number(i.investment_amount),
      0
    );
  }

  return {
    totalActiveContracts: activeContractsRes.count ?? 0,
    totalOutstandingAmount,
    totalOverdueContracts: overdueContractsRes.count ?? 0,
    totalClients: clientsRes.count ?? 0,
    totalInvestors: investorsRes.count ?? 0,
    totalProfitGenerated,
    totalProfitDistributed,
    activePhaseInvestmentTotal,
    cashInHand,
    totalOutstandingLoans,
    totalCompletedContracts: completedContractsRes.count ?? 0,
  };
}