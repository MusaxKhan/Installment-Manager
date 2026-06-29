"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { enqueueOperation } from "@/lib/offline/outbox";
import { offlineDb } from "@/lib/offline/db";
import { clientSchema } from "@/lib/validations/client";
import type { ActionResult } from "@/lib/actions/client-actions";
import type { Client } from "@/types/domain";

/**
 * Offline-capable client form.
 *
 * Online: submits straight through the Server Action (createClientAction
 * or updateClientAction), same as before — full server-side validation,
 * immediate redirect on success.
 *
 * Offline: the Server Action can't be reached at all, so we validate
 * client-side with the same Zod schema the server uses, write the
 * intent into the Dexie outbox, and let the person continue working.
 * The server re-validates and re-runs this exact operation once synced
 * (see /api/sync) — nothing here is trusted as final until then.
 */
export function ClientForm({
  action,
  defaultValues,
  defaultClientId,
  submitLabel,
}: {
  action: (
    prev: ActionResult | null,
    formData: FormData
  ) => Promise<ActionResult>;
  defaultValues?: Pick<Client, "name" | "cnic" | "phone" | "address">;
  /** Required for offline edits — identifies which client to update once synced */
  defaultClientId?: number;
  submitLabel: string;
}) {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const values = {
      name: formData.get("name"),
      cnic: formData.get("cnic"),
      phone: formData.get("phone"),
      address: formData.get("address"),
    };

    if (isOnline) {
      setIsPending(true);
      const result = await action(null, formData);
      setIsPending(false);
      if (result && !result.success) {
        setError(result.error ?? "Something went wrong.");
      }
      // On success the server action redirects, so there's nothing
      // else to do here.
      return;
    }

    // Offline path: validate locally, then queue.
    const parsed = clientSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input.");
      return;
    }

    setIsPending(true);
    try {
      const tempId = defaultClientId ?? -Date.now();

      await enqueueOperation(
        defaultClientId ? "update_client" : "create_client",
        defaultClientId ? { ...parsed.data, id: defaultClientId } : parsed.data,
        defaultClientId ? undefined : tempId
      );

      if (!defaultClientId) {
        // Optimistic cache entry so this client is immediately visible
        // and selectable (e.g. in the contract form's client picker)
        // before it has actually synced. clientCode is a placeholder —
        // the real CL-XXXX code is assigned server-side at sync time.
        await offlineDb.clients.put({
          id: tempId,
          clientCode: "Pending sync",
          name: parsed.data.name,
          cnic: parsed.data.cnic || null,
          phone: parsed.data.phone || null,
          address: parsed.data.address || null,
          isDeleted: false,
          updatedAt: new Date().toISOString(),
          syncVersion: 0,
          maxOverdueMonths: 0,
          isBlacklisted: false,
        });
      }

      toast.success(
        defaultClientId
          ? "Saved offline — will sync once you're back online."
          : "Client queued — will sync once you're back online."
      );
      router.push("/clients");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {!isOnline && (
        <Badge variant="overdue" className="flex w-fit items-center gap-1.5">
          <WifiOff className="h-3.5 w-3.5" />
          Offline — this will be queued and synced later
        </Badge>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaultValues?.name}
          placeholder="e.g. Ahmed Raza"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cnic">CNIC</Label>
          <Input
            id="cnic"
            name="cnic"
            defaultValue={defaultValues?.cnic ?? ""}
            placeholder="12345-1234567-1"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={defaultValues?.phone ?? ""}
            placeholder="03XX-XXXXXXX"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          name="address"
          defaultValue={defaultValues?.address ?? ""}
          placeholder="House, street, area, city"
        />
      </div>

      {error && (
        <p className="rounded-md bg-status-overdue-bg px-3 py-2 text-sm text-status-overdue">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}