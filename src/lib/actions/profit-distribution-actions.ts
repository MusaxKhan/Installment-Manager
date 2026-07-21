"use server";

import { revalidatePath } from "next/cache";
import {
  distributeContractProfit,
  ProfitDistributionServiceError,
} from "@/lib/services/profit-distribution-service";
import type { ActionResult } from "./client-actions";

export async function distributeProfitAction(
  contractId: number
): Promise<ActionResult> {
  try {
    await distributeContractProfit(contractId);
  } catch (err) {
    if (err instanceof ProfitDistributionServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/investors");
  revalidatePath("/dashboard");
  revalidatePath("/distributions");
  // profit_distributions feeds the "Profit Comparison by Investor"
  // chart on the graphs page.
  revalidatePath("/graphs");
  return { success: true };
}