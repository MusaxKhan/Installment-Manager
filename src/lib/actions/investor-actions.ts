"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createInvestorRecord,
  updateInvestorRecord,
  deleteInvestorRecord,
  InvestorServiceError,
} from "@/lib/services/investor-service";
import { investorSchema } from "@/lib/validations/investor";
import type { ActionResult } from "./client-actions";

export async function createInvestorAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = investorSchema.safeParse({
    name: formData.get("name"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  let newInvestorId: number;
  try {
    const investor = await createInvestorRecord(parsed.data);
    newInvestorId = investor.id;
  } catch (err) {
    if (err instanceof InvestorServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  revalidatePath("/investors");
  // Dashboard shows a count of active investors.
  revalidatePath("/dashboard");
  redirect(`/investors/${newInvestorId}`);
}

export async function updateInvestorAction(
  id: number,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = investorSchema.safeParse({
    name: formData.get("name"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    await updateInvestorRecord(id, parsed.data);
  } catch (err) {
    if (err instanceof InvestorServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  revalidatePath("/investors");
  revalidatePath(`/investors/${id}`);
  // Editing can flip the "active" flag the dashboard's investor count
  // is based on.
  revalidatePath("/dashboard");
  redirect(`/investors/${id}`);
}

export async function deleteInvestorAction(id: number): Promise<ActionResult> {
  try {
    await deleteInvestorRecord(id);
  } catch (err) {
    if (err instanceof InvestorServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  revalidatePath("/investors");
  revalidatePath("/dashboard");
  return { success: true };
}