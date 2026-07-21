"use server";

import { revalidatePath } from "next/cache";
import {
  createLoan,
  recordLoanRepayment,
  LoanServiceError,
} from "@/lib/services/loan-service";
import { loanSchema, loanRepaymentSchema } from "@/lib/validations/loan";
import type { ActionResult } from "./client-actions";

export async function createLoanAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = loanSchema.safeParse({
    lenderName: formData.get("lenderName"),
    amount: formData.get("amount"),
    reason: formData.get("reason"),
    loanDate: formData.get("loanDate"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    await createLoan(parsed.data);
  } catch (err) {
    if (err instanceof LoanServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  revalidatePath("/loans");
  revalidatePath("/dashboard");
  revalidatePath("/cash-ledger");
  revalidatePath("/graphs");
  return { success: true };
}

export async function recordLoanRepaymentAction(
  loanId: number,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = loanRepaymentSchema.safeParse({
    loanId,
    amount: formData.get("amount"),
    repaymentDate: formData.get("repaymentDate"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    await recordLoanRepayment(parsed.data);
  } catch (err) {
    if (err instanceof LoanServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  revalidatePath("/loans");
  revalidatePath("/dashboard");
  revalidatePath("/cash-ledger");
  revalidatePath("/graphs");
  return { success: true };
}