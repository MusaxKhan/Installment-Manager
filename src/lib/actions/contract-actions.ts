"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createContractRecord,
  ContractServiceError,
} from "@/lib/services/contract-service";
import { contractSchema } from "@/lib/validations/contract";
import type { ActionResult } from "./client-actions";

export async function createContractAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const hasGuarantor = formData.get("hasGuarantor") === "on";

  const parsed = contractSchema.safeParse({
    clientId: formData.get("clientId"),
    productName: formData.get("productName"),
    productDescription: formData.get("productDescription"),
    initiatedBy: formData.get("initiatedBy"),
    purchasePrice: formData.get("purchasePrice"),
    profitPercent: formData.get("profitPercent"),
    numberOfInstallments: formData.get("numberOfInstallments"),
    startDate: formData.get("startDate"),
    hasGuarantor,
    guarantor: hasGuarantor
      ? {
          name: formData.get("guarantorName"),
          phone: formData.get("guarantorPhone"),
          address: formData.get("guarantorAddress"),
          cnic: formData.get("guarantorCnic"),
        }
      : undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  let newContractId: number;
  try {
    const contract = await createContractRecord(parsed.data);
    newContractId = contract.id;
  } catch (err) {
    if (err instanceof ContractServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  revalidatePath("/contracts");
  revalidatePath(`/clients/${parsed.data.clientId}`);
  redirect(`/contracts/${newContractId}`);
}
