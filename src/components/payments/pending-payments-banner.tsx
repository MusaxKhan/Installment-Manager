"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Clock } from "lucide-react";
import { offlineDb } from "@/lib/offline/db";
import { formatDate, formatPKR } from "@/lib/utils/format";

export function PendingPaymentsBanner({ contractId }: { contractId: number }) {
  const pendingPayments = useLiveQuery(
    () =>
      offlineDb.payments
        .where("contractId")
        .equals(contractId)
        .filter((p) => p.isPendingSync === true)
        .toArray(),
    [contractId]
  );

  if (!pendingPayments || pendingPayments.length === 0) return null;

  return (
    <div className="rounded-md border border-status-partial/40 bg-status-partial-bg p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium text-status-partial">
        <Clock className="h-4 w-4" />
        {pendingPayments.length} payment{pendingPayments.length === 1 ? "" : "s"}{" "}
        queued, not yet synced
      </p>
      <ul className="mt-2 space-y-1">
        {pendingPayments.map((p) => (
          <li key={p.id} className="text-xs text-muted-foreground">
            {formatPKR(p.amountPaid)} on {formatDate(p.paymentDate)}
            {p.remarks ? ` — ${p.remarks}` : ""}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Installments will be allocated and the contract balance updated once
        these sync.
      </p>
    </div>
  );
}
