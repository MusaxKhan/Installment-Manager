"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { closeBusinessPhaseAction } from "@/lib/actions/business-phase-actions";

export function ClosePhaseButton({ phaseId }: { phaseId: number }) {
  const router = useRouter();
  const [isClosing, setIsClosing] = React.useState(false);

  async function handleClose() {
    setIsClosing(true);
    const result = await closeBusinessPhaseAction(phaseId);
    setIsClosing(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to close phase.");
      return;
    }

    toast.success("Phase closed.");
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Lock className="h-4 w-4" />
          Close Phase
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close this phase?</AlertDialogTitle>
          <AlertDialogDescription>
            New contract completions won&apos;t distribute profit through
            this phase anymore. You&apos;ll need to create a new phase
            (with its own investor investments) before any further profit
            can be distributed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleClose} disabled={isClosing}>
            {isClosing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Closing...
              </>
            ) : (
              "Close phase"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
