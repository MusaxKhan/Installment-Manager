"use server";

import { revalidatePath } from "next/cache";
import { recordPayment, PaymentServiceError } from "@/lib/services/payment-service";
import { paymentSchema } from "@/lib/validations/payment";
import type { ActionResult } from "./client-actions";

export async function recordPaymentAction(
  contractId: number,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse({
    contractId,
    amountPaid: formData.get("amountPaid"),
    paymentMethod: formData.get("paymentMethod"),
    paymentDate: formData.get("paymentDate"),
    remarks: formData.get("remarks"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  let distributionWarning: string | null = null;
  try {
    const result = await recordPayment(parsed.data);
    distributionWarning = result.distributionWarning;
  } catch (err) {
    if (err instanceof PaymentServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  revalidatePath("/investors");
  // recordPayment writes a payment_received cash_ledger entry, and can
  // also trigger automatic profit distribution if the payment completes
  // the contract (see recomputeContractStatus in contract-service.ts) —
  // so this needs the same coverage as distributeProfitAction.
  revalidatePath("/cash-ledger");
  revalidatePath("/graphs");
  revalidatePath("/distributions");
  return {
    success: true,
    warning: distributionWarning ?? undefined,
  };
}