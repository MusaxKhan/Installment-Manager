import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditPaymentDialog } from "@/components/payments/edit-payment-dialog";
import { formatDate, formatPKR } from "@/lib/utils/format";
import type { Payment, PaymentEdit } from "@/types/domain";

export function PaymentHistoryTable({
  payments,
  contractId,
  editsByPaymentId,
  profitDistributed,
}: {
  payments: Payment[];
  contractId: number;
  editsByPaymentId: Map<number, PaymentEdit[]>;
  profitDistributed: boolean;
}) {
  if (payments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No payments recorded yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>Balance After</TableHead>
          <TableHead>Remarks</TableHead>
          <TableHead className="text-right">Edit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => {
          const edits = editsByPaymentId.get(payment.id) ?? [];
          return (
            <TableRow key={payment.id}>
              <TableCell>{formatDate(payment.paymentDate)}</TableCell>
              <TableCell className="tabular-nums font-medium text-status-completed">
                {formatPKR(payment.amountPaid)}
                {edits.length > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    (edited)
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {payment.paymentMethod ?? "—"}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatPKR(payment.remainingBalance)}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground">
                {payment.remarks ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                <EditPaymentDialog
                  contractId={contractId}
                  paymentId={payment.id}
                  currentAmount={payment.amountPaid}
                  priorEdits={edits}
                  disabled={profitDistributed}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
