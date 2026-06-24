import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  createClientRecord,
  updateClientRecord,
  ClientServiceError,
} from "@/lib/services/client-service";
import {
  createContractRecord,
  ContractServiceError,
} from "@/lib/services/contract-service";
import { recordPayment, PaymentServiceError } from "@/lib/services/payment-service";
import { clientSchema } from "@/lib/validations/client";
import { contractSchema } from "@/lib/validations/contract";
import { paymentSchema } from "@/lib/validations/payment";

/**
 * Sync endpoint for the offline outbox.
 *
 * CRITICAL DESIGN RULE: this route re-runs every operation through the
 * exact same service-layer functions used by the online UI
 * (createClientRecord, createContractRecord, recordPayment). It never
 * trusts a totals/allocation number computed on the offline device —
 * those were calculated against a potentially stale local cache. The
 * server recomputes everything fresh against the current database
 * state at sync time. This is what makes "latest write wins" safe here:
 * we're not merging conflicting *numbers*, we're replaying the
 * *intent* ("record a payment of Rs. 5,000 on this date") against
 * current reality.
 *
 * Idempotency: each outbox entry carries a client-generated UUID. We
 * don't currently persist a processed-ids table (out of scope for a
 * 3-user internal tool), but each operation is naturally idempotent-ish
 * in the sense that retrying a sync call after a network blip just
 * re-runs the same create/payment — at worst this could double-record
 * a payment if the client retries after actually succeeding, so the
 * client only marks an entry as done after receiving a definitive
 * success response, and removes it from the outbox immediately after
 * (see lib/offline/sync-engine.ts).
 */

const syncRequestSchema = z.object({
  type: z.enum([
    "create_client",
    "update_client",
    "create_contract",
    "record_payment",
  ]),
  payload: z.record(z.string(), z.unknown()),
  clientUpdateId: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid sync payload.",
      },
      { status: 400 }
    );
  }

  const { type, payload, clientUpdateId } = parsed.data;

  try {
    switch (type) {
      case "create_client": {
        const validated = clientSchema.safeParse(payload);
        if (!validated.success) {
          return NextResponse.json(
            { success: false, error: validated.error.issues[0]?.message },
            { status: 400 }
          );
        }
        const client = await createClientRecord(validated.data);
        return NextResponse.json({ success: true, data: client });
      }

      case "update_client": {
        if (!clientUpdateId) {
          return NextResponse.json(
            { success: false, error: "Missing clientUpdateId for update_client." },
            { status: 400 }
          );
        }
        const validated = clientSchema.safeParse(payload);
        if (!validated.success) {
          return NextResponse.json(
            { success: false, error: validated.error.issues[0]?.message },
            { status: 400 }
          );
        }
        const client = await updateClientRecord(clientUpdateId, validated.data);
        return NextResponse.json({ success: true, data: client });
      }

      case "create_contract": {
        const validated = contractSchema.safeParse(payload);
        if (!validated.success) {
          return NextResponse.json(
            { success: false, error: validated.error.issues[0]?.message },
            { status: 400 }
          );
        }
        const contract = await createContractRecord(validated.data);
        return NextResponse.json({ success: true, data: contract });
      }

      case "record_payment": {
        const validated = paymentSchema.safeParse(payload);
        if (!validated.success) {
          return NextResponse.json(
            { success: false, error: validated.error.issues[0]?.message },
            { status: 400 }
          );
        }
        // Server recomputes allocation fresh — the offline client never
        // sends pre-computed installment allocations, only the raw
        // "amount paid against this contract on this date" intent.
        const result = await recordPayment(validated.data);
        return NextResponse.json({
          success: true,
          data: result.payment,
          warning: result.distributionWarning,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Unknown sync operation type." },
          { status: 400 }
        );
    }
  } catch (err) {
    if (
      err instanceof ClientServiceError ||
      err instanceof ContractServiceError ||
      err instanceof PaymentServiceError
    ) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: 422 }
      );
    }
    console.error("Sync endpoint unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred while syncing." },
      { status: 500 }
    );
  }
}
