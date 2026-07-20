"use server";

import { revalidatePath } from "next/cache";
import {
  createBusinessExpense,
  BusinessExpenseServiceError,
} from "@/lib/services/business-expense-service";
import { businessExpenseSchema } from "@/lib/validations/business-expense";
import type { ActionResult } from "./client-actions";

export async function createBusinessExpenseAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = businessExpenseSchema.safeParse({
    title: formData.get("title"),
    amount: formData.get("amount"),
    category: formData.get("category"),
    expenseDate: formData.get("expenseDate"),
    notes: formData.get("notes"),
    receiptReference: formData.get("receiptReference"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    await createBusinessExpense(parsed.data);
  } catch (err) {
    if (err instanceof BusinessExpenseServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/graphs");
  revalidatePath("/cash-ledger");
  return { success: true };
}
