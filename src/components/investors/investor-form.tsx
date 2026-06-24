"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { OFFLINE_BLOCKED_MESSAGE } from "@/lib/offline/guards";
import type { ActionResult } from "@/lib/actions/client-actions";
import type { Investor } from "@/types/domain";

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Saving...
        </>
      ) : (
        label
      )}
    </Button>
  );
}

export function InvestorForm({
  action,
  defaultValues,
  submitLabel,
  isCreate = false,
}: {
  action: (
    prev: ActionResult | null,
    formData: FormData
  ) => Promise<ActionResult>;
  defaultValues?: Pick<Investor, "name" | "active">;
  submitLabel: string;
  /** New investors require a live connection — see lib/offline/guards.ts */
  isCreate?: boolean;
}) {
  const { isOnline } = useOnlineStatus();
  const [state, formAction] = useActionState(action, null);
  const blocked = isCreate && !isOnline;

  return (
    <form action={formAction} className="space-y-5">
      {blocked && (
        <Badge variant="overdue" className="flex w-fit items-center gap-1.5">
          <WifiOff className="h-3.5 w-3.5" />
          {OFFLINE_BLOCKED_MESSAGE.create_investor}
        </Badge>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Investor Name</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaultValues?.name}
          placeholder="e.g. Tariq Mahmood"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="active"
          name="active"
          defaultChecked={defaultValues?.active ?? true}
        />
        <Label htmlFor="active" className="cursor-pointer">
          Active investor
        </Label>
      </div>

      {state?.error && (
        <p className="rounded-md bg-status-overdue-bg px-3 py-2 text-sm text-status-overdue">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <SubmitButton label={submitLabel} disabled={blocked} />
      </div>
    </form>
  );
}
