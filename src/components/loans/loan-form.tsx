"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, WifiOff } from "lucide-react";
import { createLoanAction } from "@/lib/actions/loan-actions";
import { toDateInputValue } from "@/lib/utils/format";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { OFFLINE_BLOCKED_MESSAGE } from "@/lib/offline/guards";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Recording...
        </>
      ) : (
        "Record Loan"
      )}
    </Button>
  );
}

export function LoanForm() {
  const { isOnline } = useOnlineStatus();
  const [state, formAction] = useActionState(createLoanAction, null);

  return (
    <form action={formAction} className="space-y-5">
      {!isOnline && (
        <Badge variant="overdue" className="flex w-fit items-center gap-1.5">
          <WifiOff className="h-3.5 w-3.5" />
          {OFFLINE_BLOCKED_MESSAGE.create_loan}
        </Badge>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="lenderName">Lender Name</Label>
        <Input
          id="lenderName"
          name="lenderName"
          required
          placeholder="e.g. Bank Al Habib, or a person's name"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Loan Amount (Rs.)</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loanDate">Loan Date</Label>
          <Input
            id="loanDate"
            name="loanDate"
            type="date"
            required
            defaultValue={toDateInputValue(new Date())}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reason">Reason (optional)</Label>
        <Textarea
          id="reason"
          name="reason"
          placeholder="What this loan is for"
        />
      </div>

      <p className="rounded-md bg-status-partial-bg px-3 py-2 text-sm text-status-partial">
        This loan amount is added directly to cash-in-hand. Repaying it
        later is a separate, manual action — it&apos;s never deducted
        automatically.
      </p>

      {state?.error && (
        <p className="rounded-md bg-status-overdue-bg px-3 py-2 text-sm text-status-overdue">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <SubmitButton disabled={!isOnline} />
      </div>
    </form>
  );
}