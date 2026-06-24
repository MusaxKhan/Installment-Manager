import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Admin client using the SERVICE ROLE key. Bypasses RLS entirely.
 *
 * SECURITY: Only ever import this in server-only code (Route Handlers,
 * Server Actions). Never import from a Client Component — the service
 * role key must never reach the browser bundle.
 *
 * Used for: inviting new partner/admin users (auth.admin.inviteUserByEmail),
 * listing/deleting auth users.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
    );
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
