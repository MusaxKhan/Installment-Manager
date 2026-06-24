"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, inviteUser, UserServiceError } from "@/lib/services/user-service";
import type { ActionResult } from "./client-actions";

const inviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  fullName: z.string().trim().min(2, "Name is required"),
  role: z.enum(["admin", "partner"]),
});

export async function inviteUserAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UserServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    await inviteUser(parsed.data);
  } catch (err) {
    if (err instanceof UserServiceError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  revalidatePath("/users");
  return { success: true };
}
