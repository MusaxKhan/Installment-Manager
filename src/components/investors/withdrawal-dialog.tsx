"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createWithdrawalAction } from "@/lib/actions/withdrawal-actions";
import { formatPKR, toDateInputValue } from "@/lib/utils/format";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { OFFLINE_BLOCKED_MESSAGE } from "@/lib/offline/guards";
import type { ActionResult } from "@/lib/actions/client-actions";

function SubmitButton({ isOnline }: { isOnline: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || !isOnline}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Recording...
        </>
      ) : (
        "Record Withdrawal"
      )}
    </Button>
  );
}

export function WithdrawalDialog({
  investorId,
  availableBalance,
}: {
  investorId: number;
  availableBalance: number;
}) {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [open, setOpen] = React.useState(false);

  const boundAction = React.useCallback(
    (prev: ActionResult | null, formData: FormData) =>
      createWithdrawalAction(investorId, prev, formData),
    [investorId]
  );

  const [state, formAction] = useActionState(boundAction, null);

  React.useEffect(() => {
    if (state?.success) {
      toast.success("Withdrawal recorded.");
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={availableBalance <= 0 || !isOnline}
          title={!isOnline ? OFFLINE_BLOCKED_MESSAGE.create_withdrawal : undefined}
        >
          {isOnline ? (
            <Banknote className="h-4 w-4" />
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
          {isOnline ? "Record Withdrawal" : "Needs Connection"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a Withdrawal</DialogTitle>
          <DialogDescription>
            Available balance: <strong>{formatPKR(availableBalance)}</strong>
          </DialogDescription>
        </DialogHeader>

        {!isOnline && (
          <Badge variant="overdue" className="flex w-fit items-center gap-1.5">
            <WifiOff className="h-3.5 w-3.5" />
            {OFFLINE_BLOCKED_MESSAGE.create_withdrawal}
          </Badge>
        )}

        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (Rs.)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              max={availableBalance}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="withdrawalDate">Withdrawal Date</Label>
            <Input
              id="withdrawalDate"
              name="withdrawalDate"
              type="date"
              required
              defaultValue={toDateInputValue(new Date())}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea id="reason" name="reason" placeholder="Any notes about this withdrawal" />
          </div>

          {state?.error && (
            <p className="rounded-md bg-status-overdue-bg px-3 py-2 text-sm text-status-overdue">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <SubmitButton isOnline={isOnline} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
