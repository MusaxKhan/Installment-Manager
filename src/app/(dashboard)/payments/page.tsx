import Link from "next/link";
import { Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAllPayments } from "@/lib/services/payments-list-service";
import { formatDate, formatPKR } from "@/lib/utils/format";

export default async function PaymentsPage() {
  const payments = await listAllPayments({ limit: 200 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Most recent {payments.length} payments across all contracts
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Wallet className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No payments recorded yet.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Balance After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/contracts/${payment.contractId}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {payment.contractCode}
                      </Link>
                    </TableCell>
                    <TableCell>{payment.clientName}</TableCell>
                    <TableCell className="tabular-nums font-medium text-status-completed">
                      {formatPKR(payment.amountPaid)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.paymentMethod ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatPKR(payment.remainingBalance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
