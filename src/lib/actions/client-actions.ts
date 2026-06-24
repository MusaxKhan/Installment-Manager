"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createClientRecord,
  updateClientRecord,
  softDeleteClient,
  ClientServiceError,
} from "@/lib/services/client-service";
import { clientSchema } from "@/lib/validations/client";

export interface ActionResult {
  success: boolean;
  error?: string;
  warning?: string;
}

export async function createClientAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    cnic: formData.get("cnic"),
    phone: formData.get("phone"),
    address: formData.get("address"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  let newClientId: number;
  try {
    const client = await createClientRecord(parsed.data);
    newClientId = client.id;
  } catch (err) {
    if (err instanceof ClientServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  revalidatePath("/clients");
  redirect(`/clients/${newClientId}`);
}

export async function updateClientAction(
  id: number,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    cnic: formData.get("cnic"),
    phone: formData.get("phone"),
    address: formData.get("address"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    await updateClientRecord(id, parsed.data);
  } catch (err) {
    if (err instanceof ClientServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function deleteClientAction(id: number): Promise<ActionResult> {
  try {
    await softDeleteClient(id);
    revalidatePath("/clients");
    return { success: true };
  } catch (err) {
    if (err instanceof ClientServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }
}
