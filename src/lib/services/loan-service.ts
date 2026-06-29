import { createClient } from "@/lib/supabase/server";

export class LoanServiceError extends Error {}

export interface Loan {
  id: number;
  lenderName: string;
  amount: number;
  reason: string | null;
  loanDate: string;
  amountRepaid: number;
  outstandingBalance: number;
  status: "ACTIVE" | "REPAID";
  createdAt: string;
}

function mapLoan(row: {
  id: number;
  lender_name: string;
  amount: number;
  reason: string | null;
  loan_date: string;
  amount_repaid: number;
  status: "ACTIVE" | "REPAID";
  created_at: string;
}): Loan {
  const amount = Number(row.amount);
  const amountRepaid = Number(row.amount_repaid);
  return {
    id: row.id,
    lenderName: row.lender_name,
    amount,
    reason: row.reason,
    loanDate: row.loan_date,
    amountRepaid,
    outstandingBalance: Math.max(0, amount - amountRepaid),
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listLoans(): Promise<Loan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loans")
    .select("*")
    .order("loan_date", { ascending: false });

  if (error) {
    throw new LoanServiceError(`Failed to list loans: ${error.message}`);
  }
  return (data ?? []).map(mapLoan);
}

export async function getTotalOutstandingLoans(): Promise<number> {
  const loans = await listLoans();
  return loans.reduce((sum, l) => sum + l.outstandingBalance, 0);
}

/**
 * Creates a loan and its cash-in ledger entry atomically via
 * create_loan() in migration 004 — same reasoning as
 * distribute_contract_profit / create_withdrawal_with_balance_check:
 * the loan row and the ledger entry must both succeed or both fail,
 * never one without the other.
 */
export async function createLoan(values: {
  lenderName: string;
  amount: number;
  reason?: string;
  loanDate: string;
}): Promise<Loan> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_loan", {
    p_lender_name: values.lenderName,
    p_amount: values.amount,
    p_reason: values.reason || null,
    p_loan_date: values.loanDate,
  });

  if (error) {
    throw new LoanServiceError(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new LoanServiceError("Loan could not be created — no row returned.");
  }
  return mapLoan(row);
}

/**
 * Records a manual repayment against a loan. Deliberately separate
 * from any automatic cash-recovery logic — repaying a loan is always
 * a distinct action someone takes, never inferred from a contract
 * completing.
 */
export async function recordLoanRepayment(values: {
  loanId: number;
  amount: number;
  repaymentDate: string;
}): Promise<Loan> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("record_loan_repayment", {
    p_loan_id: values.loanId,
    p_amount: values.amount,
    p_repayment_date: values.repaymentDate,
  });

  if (error) {
    throw new LoanServiceError(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new LoanServiceError(
      "Repayment could not be recorded — no row returned."
    );
  }
  return mapLoan(row);
}