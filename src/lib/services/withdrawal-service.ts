import { createClient } from "@/lib/supabase/server";
import { mapWithdrawal } from "./mappers";
import { round2 } from "@/lib/utils/calculations";
import type { Withdrawal, WithdrawalWithInvestor } from "@/types/domain";
import type { WithdrawalFormValues } from "@/lib/validations/withdrawal";

export class WithdrawalServiceError extends Error {}

export async function listWithdrawalsForInvestor(
  investorId: number,
  totalDistributed: number
): Promise<(Withdrawal & { remainingBalance: number })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("investor_id", investorId)
    .order("withdrawal_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new WithdrawalServiceError(
      `Failed to list withdrawals: ${error.message}`
    );
  }

  let runningBalance = totalDistributed;
  const withBalances = (data ?? []).map((row) => {
    runningBalance = round2(runningBalance - Number(row.amount));
    return { ...mapWithdrawal(row), remainingBalance: runningBalance };
  });

  // Newest first for display, matching the rest of the app's history lists.
  return withBalances.reverse();
}

export async function listAllWithdrawals(): Promise<WithdrawalWithInvestor[]> {
  const supabase = await createClient();

  // Fetch the FULL withdrawal history (not capped) — computing a
  // correct running balance per investor requires every prior
  // withdrawal in chronological order, not just whichever page of
  // recent ones we're about to display. Capping happens after the
  // balance math, not before.
  const [withdrawalsRes, distributionsRes] = await Promise.all([
    supabase
      .from("withdrawals")
      .select("*, investor:investors(name)")
      .order("withdrawal_date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("profit_distributions").select("investor_id, profit_amount"),
  ]);

  if (withdrawalsRes.error) {
    throw new WithdrawalServiceError(
      `Failed to list withdrawals: ${withdrawalsRes.error.message}`
    );
  }
  if (distributionsRes.error) {
    throw new WithdrawalServiceError(
      `Failed to load distributed profit totals: ${distributionsRes.error.message}`
    );
  }

  const totalDistributedByInvestor = new Map<number, number>();
  for (const row of distributionsRes.data ?? []) {
    if (row.investor_id === null) continue;
    totalDistributedByInvestor.set(
      row.investor_id,
      (totalDistributedByInvestor.get(row.investor_id) ?? 0) +
        Number(row.profit_amount)
    );
  }

  // Walk each investor's withdrawals oldest-first, subtracting as we
  // go, so remainingBalance on each row reflects their balance
  // immediately after that specific withdrawal.
  const runningBalanceByInvestor = new Map<number, number>();
  const withResults: WithdrawalWithInvestor[] = [];

  for (const row of withdrawalsRes.data ?? []) {
    const startingBalance =
      runningBalanceByInvestor.get(row.investor_id) ??
      totalDistributedByInvestor.get(row.investor_id) ??
      0;
    const balanceAfter = round2(startingBalance - Number(row.amount));
    runningBalanceByInvestor.set(row.investor_id, balanceAfter);

    withResults.push({
      ...mapWithdrawal(row),
      investorName: row.investor?.name ?? "Unknown investor",
      remainingBalance: balanceAfter,
    });
  }

  // Display newest-first, same ordering the page expects, capped at
  // 200 most recent for display only — the balance math above already
  // used the full history.
  return withResults
    .sort(
      (a, b) =>
        new Date(b.withdrawalDate).getTime() -
        new Date(a.withdrawalDate).getTime()
    )
    .slice(0, 200);
}

/**
 * Records a withdrawal after checking it doesn't exceed the investor's
 * available balance (distributed profit minus prior withdrawals).
 *
 * The balance check and the insert happen inside a single Postgres
 * function (`create_withdrawal_with_balance_check`, see
 * supabase/sql/003_withdrawal_race_fix.sql) which locks the investor
 * row for the duration of the transaction. This closes the race window
 * that existed in an earlier version of this function, where reading
 * the balance and inserting the withdrawal were two separate
 * round-trips — two withdrawals submitted at the same instant could
 * both read the same "available" balance and both succeed, jointly
 * overdrawing the investor.
 */
export async function createWithdrawal(
  values: WithdrawalFormValues
): Promise<Withdrawal> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "create_withdrawal_with_balance_check",
    {
      p_investor_id: values.investorId,
      p_amount: values.amount,
      p_reason: values.reason || null,
      p_withdrawal_date: values.withdrawalDate,
    }
  );

  if (error) {
    // Postgres RAISE EXCEPTION messages (insufficient balance, investor
    // not found, invalid amount) come through as error.message, already
    // human-readable — see the function body for the exact wording.
    throw new WithdrawalServiceError(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new WithdrawalServiceError(
      "Withdrawal could not be recorded — no row was returned."
    );
  }

  return mapWithdrawal(row);
}