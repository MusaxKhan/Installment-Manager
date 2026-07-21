"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createContractRecord,
  updateContractRecord,
  deleteContract,
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
  // createContractRecord writes a "purchase" cash_ledger entry, which
  // dashboard/cash-ledger/graphs all read from — see the audit note in
  // deleteContractAction below for why every action that moves cash
  // needs to refresh these three.
  revalidatePath("/dashboard");
  revalidatePath("/cash-ledger");
  revalidatePath("/graphs");
  redirect(`/contracts/${newContractId}`);
}

export async function updateContractAction(
  contractId: number,
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
    console.log(parsed.error.flatten());

    return {
      success: false,
      error: JSON.stringify(parsed.error.flatten()),
    };
  }

  try {
    await updateContractRecord(
      contractId,
      parsed.data
    );
  } catch (err) {
    if (err instanceof ContractServiceError) {
      return {
        success: false,
        error: err.message,
      };
    }

    throw err;
  }

  revalidatePath("/contracts");
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/contracts/${contractId}/edit`);
  revalidatePath(`/clients/${parsed.data.clientId}`);
  // Only actually moves cash when purchasePrice/startDate changed
  // (updateContractRecord syncs the ledger only in that case), but
  // revalidating unconditionally is cheap and one fewer thing to get
  // wrong later if that condition changes.
  revalidatePath("/dashboard");
  revalidatePath("/cash-ledger");
  revalidatePath("/graphs");

  redirect(`/contracts/${contractId}`);
}

export async function deleteContractAction(
  contractId: number,
  clientId: number,
  reverseCash: boolean
): Promise<ActionResult> {
  try {
    await deleteContract(contractId, reverseCash);
  } catch (err) {
    if (err instanceof ContractServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  revalidatePath("/contracts");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/cash-ledger");
  revalidatePath("/graphs");
  revalidatePath("/payments");

  return { success: true };
}