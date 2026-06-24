"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { editPaymentAction } from "@/lib/actions/payment-edit-actions";
import { formatDateTime, formatPKR } from "@/lib/utils/format";
import type { ActionResult } from "@/lib/actions/client-actions";
import type { PaymentEdit } from "@/types/domain";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Saving...
        </>
      ) : (
        "Save Correction"
      )}
    </Button>
  );
}

export function EditPaymentDialog({
  contractId,
  paymentId,
  currentAmount,
  priorEdits,
  disabled,
}: {
  contractId: number;
  paymentId: number;
  currentAmount: number;
  priorEdits: PaymentEdit[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const boundAction = React.useCallback(
    (prev: ActionResult | null, formData: FormData) =>
      editPaymentAction(contractId, paymentId, prev, formData),
    [contractId, paymentId]
  );

  const [state, formAction] = useActionState(boundAction, null);

  React.useEffect(() => {
    if (state?.success) {
      toast.success("Payment corrected. The change has been logged.");
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          disabled={disabled}
          title={disabled ? "Profit already distributed for this contract" : "Correct this payment"}
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit payment</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct Payment Amount</DialogTitle>
          <DialogDescription>
            Current amount: <strong>{formatPKR(currentAmount)}</strong>. This
            change is permanently logged — old value, new value, who, and
            why.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="newAmount">Corrected Amount (Rs.)</Label>
            <Input
              id="newAmount"
              name="newAmount"
              type="number"
              min="0.01"
              step="0.01"
              required
              defaultValue={currentAmount}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason for Correction</Label>
            <Textarea
              id="reason"
              name="reason"
              required
              placeholder="e.g. Typed Rs. 5,000 instead of Rs. 50,000"
            />
          </div>

          {state?.error && (
            <p className="rounded-md bg-status-overdue-bg px-3 py-2 text-sm text-status-overdue">
              {state.error}
            </p>
          )}

          {priorEdits.length > 0 && (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                Edit history
              </p>
              <ul className="space-y-1.5">
                {priorEdits.map((edit) => (
                  <li key={edit.id} className="text-xs text-muted-foreground">
                    {formatPKR(edit.oldAmount)} → {formatPKR(edit.newAmount)}
                    {" — "}
                    {edit.reason} ({edit.editedBy}, {formatDateTime(edit.editedAt)})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
