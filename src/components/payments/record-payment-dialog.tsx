"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { recordPaymentAction } from "@/lib/actions/payment-actions";
import { PAYMENT_METHODS, paymentSchema } from "@/lib/validations/payment";
import { toDateInputValue } from "@/lib/utils/format";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { enqueueOperation } from "@/lib/offline/outbox";
import { offlineDb } from "@/lib/offline/db";
import type { ActionResult } from "@/lib/actions/client-actions";

function SubmitButton({ isOnline, isPending }: { isOnline: boolean; isPending: boolean }) {
  const { pending: formPending } = useFormStatus();
  const pending = isOnline ? formPending : isPending;
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Recording...
        </>
      ) : (
        "Record Payment"
      )}
    </Button>
  );
}

export function RecordPaymentDialog({
  contractId,
  remainingBalance,
}: {
  contractId: number;
  remainingBalance: number;
}) {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [open, setOpen] = React.useState(false);
  const [offlinePending, setOfflinePending] = React.useState(false);
  const [offlineError, setOfflineError] = React.useState<string | null>(null);

  const boundAction = React.useCallback(
    (prev: ActionResult | null, formData: FormData) =>
      recordPaymentAction(contractId, prev, formData),
    [contractId]
  );

  const [state, formAction] = useActionState(boundAction, null);

  React.useEffect(() => {
    if (state?.success) {
      toast.success("Payment recorded and allocated to installments.");
      if (state.warning) {
        toast.warning(state.warning, { duration: 8000 });
      }
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  async function handleOfflineSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOfflineError(null);

    const formData = new FormData(e.currentTarget);
    const values = {
      contractId,
      amountPaid: formData.get("amountPaid"),
      paymentMethod: formData.get("paymentMethod"),
      paymentDate: formData.get("paymentDate"),
      remarks: formData.get("remarks"),
    };

    const parsed = paymentSchema.safeParse(values);
    if (!parsed.success) {
      setOfflineError(parsed.error.issues[0]?.message ?? "Invalid input.");
      return;
    }

    setOfflinePending(true);
    try {
      await enqueueOperation("record_payment", parsed.data);

      // Write a locally-visible pending payment so the contract detail
      // page shows it immediately, clearly marked as not-yet-synced.
      // Uses a negative temp ID so it can never collide with a real
      // server-assigned payment id once that arrives on next sync.
      const tempId = -Date.now();
      await offlineDb.payments.add({
        id: tempId,
        contractId,
        amountPaid: parsed.data.amountPaid,
        remainingBalance: Math.max(0, remainingBalance - parsed.data.amountPaid),
        paymentMethod: parsed.data.paymentMethod,
        remarks: parsed.data.remarks || null,
        paymentDate: parsed.data.paymentDate,
        updatedAt: new Date().toISOString(),
        syncVersion: 0,
        isPendingSync: true,
      });

      toast.success(
        "Payment queued — installments will be allocated once this syncs."
      );
      setOpen(false);
      router.refresh();
    } finally {
      setOfflinePending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={remainingBalance <= 0}>
          <Plus className="h-4 w-4" />
          Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a Payment</DialogTitle>
          <DialogDescription>
            This will be applied to the oldest outstanding installments first.
          </DialogDescription>
        </DialogHeader>

        {!isOnline && (
          <Badge variant="overdue" className="flex w-fit items-center gap-1.5">
            <WifiOff className="h-3.5 w-3.5" />
            Offline — installment allocation happens once this syncs
          </Badge>
        )}

        <form
          action={isOnline ? formAction : undefined}
          onSubmit={isOnline ? undefined : handleOfflineSubmit}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="amountPaid">Amount Paid (Rs.)</Label>
            <Input
              id="amountPaid"
              name="amountPaid"
              type="number"
              min="0.01"
              step="0.01"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select name="paymentMethod" defaultValue="Cash" required>
                <SelectTrigger id="paymentMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                name="paymentDate"
                type="date"
                required
                defaultValue={toDateInputValue(new Date())}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="remarks">Remarks (optional)</Label>
            <Textarea id="remarks" name="remarks" placeholder="Any notes about this payment" />
          </div>

          {(state?.error || offlineError) && (
            <p className="rounded-md bg-status-overdue-bg px-3 py-2 text-sm text-status-overdue">
              {state?.error || offlineError}
            </p>
          )}

          <DialogFooter>
            <SubmitButton isOnline={isOnline} isPending={offlinePending} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
