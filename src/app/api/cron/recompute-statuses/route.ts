import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeAllContractStatuses } from "@/lib/services/contract-service";

/**
 * Sweeps every ACTIVE/OVERDUE contract and recomputes status +
 * overdue_months, which in turn drives client blacklist status
 * (client-service.ts reads overdue_months) and auto profit
 * distribution (recomputeContractStatus triggers it on completion).
 *
 * Without this running on a schedule, a contract that receives no
 * payments at all never has its overdue status touched — see
 * recomputeAllContractStatuses() for the full explanation.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>`. Set CRON_SECRET
 * in your environment and configure vercel.json (already included in
 * this repo) to call this on a schedule with that header. You can also
 * call this manually any time to force an immediate recompute — useful
 * for testing without waiting for the schedule to fire, e.g.:
 *
 *   curl -X POST https://your-app.vercel.app/api/cron/recompute-statuses \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET"
 *
 * Uses the service-role admin client because this runs with no user
 * session (RLS on contracts/installments requires authenticated staff).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const result = await recomputeAllContractStatuses(supabase);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Vercel Cron sends GET requests. Delegate to the same handler.
export async function GET(request: NextRequest) {
  return POST(request);
}