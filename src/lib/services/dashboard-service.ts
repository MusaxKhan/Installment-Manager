import { createClient } from "@/lib/supabase/server";
import type { DashboardStats } from "@/types/domain";

export class DashboardServiceError extends Error {}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const [
    activeContractsRes,
    overdueContractsRes,
    clientsRes,
    investorsRes,
    contractsRes,
    completedContractsRes,
    distributionsRes,
    activePhaseRes,
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
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("is_deleted", false),
    supabase
      .from("investors")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    supabase
      .from("contracts")
      .select("remaining_balance")
      .in("status", ["ACTIVE", "OVERDUE"]),
    supabase.from("contracts").select("profit_amount").eq("status", "COMPLETED"),
    supabase.from("profit_distributions").select("profit_amount"),
    supabase
      .from("business_phases")
      .select("id")
      .eq("status", "ACTIVE")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const firstError = [
    activeContractsRes,
    overdueContractsRes,
    clientsRes,
    investorsRes,
    contractsRes,
    completedContractsRes,
    distributionsRes,
    activePhaseRes,
  ].find((r) => r.error)?.error;

  if (firstError) {
    throw new DashboardServiceError(
      `Failed to load dashboard stats: ${firstError.message}`
    );
  }

  const totalOutstandingAmount = (contractsRes.data ?? []).reduce(
    (sum, c) => sum + Number(c.remaining_balance),
    0
  );

  const totalProfitGenerated = (completedContractsRes.data ?? []).reduce(
    (sum, c) => sum + Number(c.profit_amount),
    0
  );

  const totalProfitDistributed = (distributionsRes.data ?? []).reduce(
    (sum, d) => sum + Number(d.profit_amount),
    0
  );

  let activePhaseInvestmentTotal = 0;
  if (activePhaseRes.data?.id) {
    const { data: investments, error: investmentsError } = await supabase
      .from("investor_phase_investments")
      .select("investment_amount")
      .eq("phase_id", activePhaseRes.data.id);

    if (investmentsError) {
      throw new DashboardServiceError(
        `Failed to load active phase investment total: ${investmentsError.message}`
      );
    }

    activePhaseInvestmentTotal = (investments ?? []).reduce(
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
  };
}
