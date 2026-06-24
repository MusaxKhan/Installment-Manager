"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Coins, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { distributeProfitAction } from "@/lib/actions/profit-distribution-actions";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { OFFLINE_BLOCKED_MESSAGE } from "@/lib/offline/guards";

export function DistributeProfitButton({
  contractId,
}: {
  contractId: number;
}) {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [isPending, setIsPending] = React.useState(false);

  async function handleClick() {
    if (!isOnline) {
      toast.error(OFFLINE_BLOCKED_MESSAGE.distribute_profit);
      return;
    }

    setIsPending(true);
    const result = await distributeProfitAction(contractId);
    setIsPending(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to distribute profit.");
      return;
    }

    toast.success("Profit distributed to investors.");
    router.refresh();
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isPending || !isOnline}
      variant="accent"
      size="sm"
      title={!isOnline ? OFFLINE_BLOCKED_MESSAGE.distribute_profit : undefined}
    >
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Distributing...
        </>
      ) : !isOnline ? (
        <>
          <WifiOff className="h-4 w-4" />
          Needs Connection
        </>
      ) : (
        <>
          <Coins className="h-4 w-4" />
          Distribute Profit
        </>
      )}
    </Button>
  );
}
