import { createClient } from "@/lib/supabase/server";
import { mapProfitDistribution } from "./mappers";
import type {
  ProfitDistribution,
  ProfitDistributionWithDetails,
} from "@/types/domain";

export class ProfitDistributionServiceError extends Error {}

/**
 * Triggers profit distribution for a completed contract. All validation
 * (contract must be COMPLETED, must not already be distributed, an
 * active phase must exist with investments) happens inside the
 * `distribute_contract_profit` Postgres function — see
 * supabase/sql/002_phase2_migration.sql for why this needs to be one
 * atomic transaction rather than several sequential client calls.
 */
export async function distributeContractProfit(
  contractId: number
): Promise<ProfitDistribution[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("distribute_contract_profit", {
    p_contract_id: contractId,
  });

  if (error) {
    // Postgres RAISE EXCEPTION messages come through as error.message —
    // these are already human-readable (see the function body).
    throw new ProfitDistributionServiceError(error.message);
  }

  return (data ?? []).map(mapProfitDistribution);
}

export async function listDistributionsForContract(
  contractId: number
): Promise<ProfitDistributionWithDetails[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profit_distributions")
    .select(
      "*, investor:investors(name), contract:contracts(contract_code), phase:business_phases(phase_name)"
    )
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ProfitDistributionServiceError(
      `Failed to load distributions: ${error.message}`
    );
  }

  return (data ?? []).map((row) => ({
    ...mapProfitDistribution(row),
    investorName: row.investor?.name ?? "Unknown investor",
    contractCode: row.contract?.contract_code ?? "",
    phaseName: row.phase?.phase_name ?? null,
  }));
}

export async function listDistributionsForInvestor(
  investorId: number
): Promise<ProfitDistributionWithDetails[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profit_distributions")
    .select(
      "*, investor:investors(name), contract:contracts(contract_code), phase:business_phases(phase_name)"
    )
    .eq("investor_id", investorId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ProfitDistributionServiceError(
      `Failed to load investor distributions: ${error.message}`
    );
  }

  return (data ?? []).map((row) => ({
    ...mapProfitDistribution(row),
    investorName: row.investor?.name ?? "Unknown investor",
    contractCode: row.contract?.contract_code ?? "",
    phaseName: row.phase?.phase_name ?? null,
  }));
}

export async function listAllDistributions(): Promise<
  ProfitDistributionWithDetails[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profit_distributions")
    .select(
      "*, investor:investors(name), contract:contracts(contract_code), phase:business_phases(phase_name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new ProfitDistributionServiceError(
      `Failed to load distributions: ${error.message}`
    );
  }

  return (data ?? []).map((row) => ({
    ...mapProfitDistribution(row),
    investorName: row.investor?.name ?? "Unknown investor",
    contractCode: row.contract?.contract_code ?? "",
    phaseName: row.phase?.phase_name ?? null,
  }));
}
