import { createClient } from "@/lib/supabase/server";
import { mapWithdrawal } from "./mappers";
import type { Withdrawal, WithdrawalWithInvestor } from "@/types/domain";
import type { WithdrawalFormValues } from "@/lib/validations/withdrawal";

export class WithdrawalServiceError extends Error {}

export async function listWithdrawalsForInvestor(
  investorId: number
): Promise<Withdrawal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("investor_id", investorId)
    .order("withdrawal_date", { ascending: false });

  if (error) {
    throw new WithdrawalServiceError(
      `Failed to list withdrawals: ${error.message}`
    );
  }
  return (data ?? []).map(mapWithdrawal);
}

export async function listAllWithdrawals(): Promise<WithdrawalWithInvestor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("withdrawals")
    .select("*, investor:investors(name)")
    .order("withdrawal_date", { ascending: false })
    .limit(200);

  if (error) {
    throw new WithdrawalServiceError(
      `Failed to list withdrawals: ${error.message}`
    );
  }

  return (data ?? []).map((row) => ({
    ...mapWithdrawal(row),
    investorName: row.investor?.name ?? "Unknown investor",
  }));
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
