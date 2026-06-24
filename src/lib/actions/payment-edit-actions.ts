"use server";

import { revalidatePath } from "next/cache";
import {
  editPaymentAmount,
  PaymentServiceError,
} from "@/lib/services/payment-service";
import { getCurrentUserProfile } from "@/lib/services/user-service";
import { paymentEditSchema } from "@/lib/validations/payment";
import type { ActionResult } from "./client-actions";

export async function editPaymentAction(
  contractId: number,
  paymentId: number,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = paymentEditSchema.safeParse({
    paymentId,
    newAmount: formData.get("newAmount"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const profile = await getCurrentUserProfile();
  const editedByName = profile?.fullName ?? profile?.email ?? "Unknown user";

  try {
    await editPaymentAmount(parsed.data, editedByName);
  } catch (err) {
    if (err instanceof PaymentServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/payments");
  return { success: true };
}
