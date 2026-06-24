"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
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
import { removeInvestmentAction } from "@/lib/actions/business-phase-actions";

export function RemoveInvestmentButton({
  investmentId,
  phaseId,
  investorName,
}: {
  investmentId: number;
  phaseId: number;
  investorName: string;
}) {
  const router = useRouter();
  const [isRemoving, setIsRemoving] = React.useState(false);

  async function handleRemove() {
    setIsRemoving(true);
    const result = await removeInvestmentAction(investmentId, phaseId);
    setIsRemoving(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to remove investment.");
      return;
    }

    toast.success("Investment removed.");
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-status-overdue">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Remove investment</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {investorName}&apos;s investment?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes their investment from this phase entirely. Every
            other investor&apos;s percentage share will recalculate
            automatically. This can&apos;t be done if the phase already
            has profit distributions recorded against it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRemove} disabled={isRemoving}>
            {isRemoving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Removing...
              </>
            ) : (
              "Remove"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
