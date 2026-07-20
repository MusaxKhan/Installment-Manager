"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2, WifiOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { deleteContractAction } from "@/lib/actions/contract-actions";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { OFFLINE_BLOCKED_MESSAGE } from "@/lib/offline/guards";
import { formatPKR } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

type CashMode = "reverse" | "keep";

export function DeleteContractButton({
  contractId,
  contractCode,
  clientId,
  status,
  profitDistributed,
  purchasePrice,
  totalPaid,
}: {
  contractId: number;
  contractCode: string;
  clientId: number;
  status: "ACTIVE" | "COMPLETED" | "OVERDUE";
  profitDistributed: boolean;
  purchasePrice: number;
  totalPaid: number;
}) {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [open, setOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const hasPayments = totalPaid > 0;
  const [mode, setMode] = React.useState<CashMode>("keep");

  const blocked = status === "COMPLETED" && profitDistributed;

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteContractAction(
      contractId,
      clientId,
      // With no payments there's nothing to "keep" — always fully undo.
      hasPayments ? mode === "reverse" : true
    );
    setIsDeleting(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to delete contract.");
      return;
    }

    toast.success(`Contract ${contractCode} was deleted.`);
    setOpen(false);
    router.push("/contracts");
  }

  if (blocked) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        title="This contract's profit has already been distributed to investors and can't be deleted. Reverse the distribution manually first if it must be removed."
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (!isOnline) {
            toast.error(OFFLINE_BLOCKED_MESSAGE.delete_contract);
            return;
          }
          setOpen(true);
        }}
        disabled={!isOnline}
        title={!isOnline ? OFFLINE_BLOCKED_MESSAGE.delete_contract : undefined}
      >
        {!isOnline ? (
          <>
            <WifiOff className="h-4 w-4" />
            Needs Connection
          </>
        ) : (
          <>
            <Trash2 className="h-4 w-4" />
            Delete
          </>
        )}
      </Button>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete contract {contractCode}?</DialogTitle>
          <DialogDescription>
            This permanently removes the contract, its installment
            schedule, and its payment history. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {!hasPayments ? (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            No payments have been recorded on this contract yet, so
            there&apos;s nothing to reconcile — deleting it will also
            reverse the {formatPKR(purchasePrice)} purchase entry, restoring
            that amount to cash-in-hand as if this contract was never
            created.
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This contract has {formatPKR(totalPaid)} in recorded
              payments. Choose what should happen to cash-in-hand and your
              other totals:
            </p>

            <button
              type="button"
              onClick={() => setMode("keep")}
              className={cn(
                "w-full rounded-md border p-3 text-left transition-colors",
                mode === "keep"
                  ? "border-accent bg-accent/10"
                  : "border-border hover:bg-muted/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Keep the cash history
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cash-in-hand and your totals stay exactly as they are —
                    the {formatPKR(purchasePrice)} spent and the{" "}
                    {formatPKR(totalPaid)} collected both remain reflected
                    in your books, just no longer tied to a contract. Use
                    this if the money involved was real and you&apos;re
                    only removing the contract record itself (e.g. it was
                    settled outside the system, or you&apos;re cleaning up
                    old records).
                  </p>
                </div>
                {mode === "keep" && (
                  <Check className="h-4 w-4 shrink-0 text-accent" />
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("reverse")}
              className={cn(
                "w-full rounded-md border p-3 text-left transition-colors",
                mode === "reverse"
                  ? "border-accent bg-accent/10"
                  : "border-border hover:bg-muted/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Fully undo — reverse the cash too
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cash-in-hand is adjusted as if this contract never
                    existed: the {formatPKR(purchasePrice)} purchase entry
                    and the {formatPKR(totalPaid)} in payments are both
                    removed from the ledger. Use this only if the contract
                    was created by mistake and none of this cash movement
                    actually reflects reality.
                  </p>
                </div>
                {mode === "reverse" && (
                  <Check className="h-4 w-4 shrink-0 text-accent" />
                )}
              </div>
            </button>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
              </>
            ) : (
              "Delete contract"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}