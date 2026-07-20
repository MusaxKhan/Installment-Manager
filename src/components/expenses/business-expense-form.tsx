"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
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
import { Loader2, WifiOff } from "lucide-react";
import { createBusinessExpenseAction } from "@/lib/actions/business-expense-actions";
import { toDateInputValue } from "@/lib/utils/format";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { OFFLINE_BLOCKED_MESSAGE } from "@/lib/offline/guards";
import { BUSINESS_EXPENSE_CATEGORY_LABELS } from "@/types/domain";
import { BUSINESS_EXPENSE_CATEGORIES } from "@/lib/validations/business-expense";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Recording...
        </>
      ) : (
        "Record Expense"
      )}
    </Button>
  );
}

export function BusinessExpenseForm() {
  const { isOnline } = useOnlineStatus();
  const [state, formAction] = useActionState(createBusinessExpenseAction, null);
  const [category, setCategory] = useState<string>("other");

  return (
    <form action={formAction} className="space-y-5">
      {!isOnline && (
        <Badge variant="overdue" className="flex w-fit items-center gap-1.5">
          <WifiOff className="h-3.5 w-3.5" />
          {OFFLINE_BLOCKED_MESSAGE.create_business_expense}
        </Badge>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          placeholder="e.g. Shop rent for July, Fuel for delivery van"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount (Rs.)</Label>
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
          <Label htmlFor="expenseDate">Expense Date</Label>
          <Input
            id="expenseDate"
            name="expenseDate"
            type="date"
            required
            defaultValue={toDateInputValue(new Date())}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category-select">Category</Label>
        <input type="hidden" name="category" value={category} />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="category-select">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {BUSINESS_EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {BUSINESS_EXPENSE_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" placeholder="Any extra detail" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="receiptReference">Receipt Reference (optional)</Label>
        <Input
          id="receiptReference"
          name="receiptReference"
          placeholder="Receipt #, invoice #, or a note on where it's filed"
        />
      </div>

      <p className="rounded-md bg-status-partial-bg px-3 py-2 text-sm text-status-partial">
        This amount is deducted from cash-in-hand immediately. If cash-in-hand
        doesn&apos;t cover it, the expense is refused rather than recorded.
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