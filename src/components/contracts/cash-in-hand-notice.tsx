import Link from "next/link";
import { AlertTriangle, Wallet, CheckCircle2 } from "lucide-react";
import { formatPKR } from "@/lib/utils/format";

export function CashInHandNotice({
  cashInHand,
  purchasePrice,
}: {
  cashInHand: number;
  purchasePrice: number;
}) {
  const exceeds = purchasePrice > 0 && purchasePrice > cashInHand;
  const shortfall = exceeds ? purchasePrice - cashInHand : 0;

  if (!exceeds) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-status-completed/30 bg-status-completed-bg px-3 py-2 text-sm text-status-completed">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>
          Cash in hand: <strong>{formatPKR(cashInHand)}</strong>
          {purchasePrice > 0 && " — enough to cover this purchase."}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-status-overdue/30 bg-status-overdue-bg px-3 py-3 text-sm">
      <div className="flex items-start gap-2 text-status-overdue">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">
            This purchase exceeds your current cash in hand.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cash in hand: <strong>{formatPKR(cashInHand)}</strong> · Purchase
            price: <strong>{formatPKR(purchasePrice)}</strong> · Short by{" "}
            <strong>{formatPKR(shortfall)}</strong>
          </p>
        </div>
      </div>
      <Link
        href="/loans/new"
        target="_blank"
        className="inline-flex items-center gap-1.5 rounded-md bg-status-overdue px-3 py-1.5 text-xs font-medium text-white hover:bg-status-overdue/90"
      >
        <Wallet className="h-3.5 w-3.5" />
        Take a loan to cover the shortfall
      </Link>
      <p className="text-xs text-muted-foreground">
        Opens in a new tab so you don&apos;t lose what you&apos;ve entered
        here. Come back and continue once the loan is recorded.
      </p>
    </div>
  );
}