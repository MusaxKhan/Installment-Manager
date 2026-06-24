import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserProfile } from "@/types/domain";

export class UserServiceError extends Error {}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new UserServiceError(
      `Failed to fetch user profile: ${error.message}`
    );
  }
  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role as UserProfile["role"],
    createdAt: data.created_at,
  };
}

export async function requireAdmin(): Promise<UserProfile> {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== "admin") {
    throw new UserServiceError("This action requires admin privileges.");
  }
  return profile;
}

export async function listUserProfiles(): Promise<UserProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw new UserServiceError(`Failed to list users: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role as UserProfile["role"],
    createdAt: row.created_at,
  }));
}

/**
 * Admin-only: invites a new partner (or admin) user by email.
 * Uses the service-role admin client — must only be called from a
 * server-side Route Handler/Server Action that has already verified
 * the caller is an admin via requireAdmin().
 */
export async function inviteUser(params: {
  email: string;
  fullName: string;
  role: "admin" | "partner";
}): Promise<void> {
  const adminClient = createAdminClient();

  const { error } = await adminClient.auth.admin.inviteUserByEmail(
    params.email,
    {
      data: {
        full_name: params.fullName,
        role: params.role,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
    }
  );

  if (error) {
    throw new UserServiceError(`Failed to invite user: ${error.message}`);
  }
}
