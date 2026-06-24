"use server";

import { revalidatePath } from "next/cache";
import {
  createWithdrawal,
  WithdrawalServiceError,
} from "@/lib/services/withdrawal-service";
import { withdrawalSchema } from "@/lib/validations/withdrawal";
import type { ActionResult } from "./client-actions";

export async function createWithdrawalAction(
  investorId: number,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = withdrawalSchema.safeParse({
    investorId,
    amount: formData.get("amount"),
    reason: formData.get("reason"),
    withdrawalDate: formData.get("withdrawalDate"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    await createWithdrawal(parsed.data);
  } catch (err) {
    if (err instanceof WithdrawalServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  revalidatePath(`/investors/${investorId}`);
  revalidatePath("/investors");
  revalidatePath("/withdrawals");
  return { success: true };
}
