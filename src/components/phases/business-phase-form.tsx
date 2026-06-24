"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, WifiOff } from "lucide-react";
import { createBusinessPhaseAction } from "@/lib/actions/business-phase-actions";
import { toDateInputValue } from "@/lib/utils/format";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { OFFLINE_BLOCKED_MESSAGE } from "@/lib/offline/guards";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Creating...
        </>
      ) : (
        "Create Phase"
      )}
    </Button>
  );
}

export function BusinessPhaseForm({ hasActivePhase }: { hasActivePhase: boolean }) {
  const { isOnline } = useOnlineStatus();
  const [state, formAction] = useActionState(createBusinessPhaseAction, null);

  return (
    <form action={formAction} className="space-y-5">
      {!isOnline && (
        <Badge variant="overdue" className="flex w-fit items-center gap-1.5">
          <WifiOff className="h-3.5 w-3.5" />
          {OFFLINE_BLOCKED_MESSAGE.create_business_phase}
        </Badge>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="phaseName">Phase Name</Label>
        <Input
          id="phaseName"
          name="phaseName"
          required
          placeholder="e.g. 2026 Q1 Investment Round"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            required
            defaultValue={toDateInputValue(new Date())}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">End Date (optional)</Label>
          <Input id="endDate" name="endDate" type="date" />
        </div>
      </div>

      {hasActivePhase && (
        <p className="rounded-md bg-status-partial-bg px-3 py-2 text-sm text-status-partial">
          You already have an active phase. Creating a new one will
          automatically close it — any contracts not yet completed will
          still distribute profit against whichever phase is active when
          they complete.
        </p>
      )}

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
