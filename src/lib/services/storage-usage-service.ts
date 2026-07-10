import { createClient } from "@/lib/supabase/server";

export class StorageUsageServiceError extends Error {}

export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
  percentUsed: number;
}

// Supabase doesn't expose a project's plan/quota through the database
// itself — that's account/billing metadata, not something a SQL query
// can see. This defaults to the Free tier's 500 MB database limit;
// override SUPABASE_DB_QUOTA_MB in your environment if this project is
// on Pro (8 GB included) or a different plan, or the percentage below
// will be measured against the wrong ceiling.
const DEFAULT_QUOTA_MB = 500;
const QUOTA_BYTES =
  Number(process.env.SUPABASE_DB_QUOTA_MB ?? DEFAULT_QUOTA_MB) * 1024 * 1024;

export async function getStorageUsage(): Promise<StorageUsage> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_database_size_bytes");

  if (error) {
    throw new StorageUsageServiceError(
      `Failed to load database size: ${error.message}`
    );
  }

  const usedBytes = Number(data ?? 0);

  return {
    usedBytes,
    quotaBytes: QUOTA_BYTES,
    percentUsed: QUOTA_BYTES > 0 ? Math.min(100, (usedBytes / QUOTA_BYTES) * 100) : 0,
  };
}