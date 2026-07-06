import Link from "next/link";
import { Banknote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAllWithdrawals } from "@/lib/services/withdrawal-service";
import { formatDate, formatPKR } from "@/lib/utils/format";

export default async function WithdrawalsPage() {
  const withdrawals = await listAllWithdrawals();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Withdrawals</h1>
        <p className="text-sm text-muted-foreground">
          Most recent {withdrawals.length} withdrawals across all investors
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {withdrawals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Banknote className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No withdrawals recorded yet.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Investor</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Remaining Profit</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>{formatDate(w.withdrawalDate)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/investors/${w.investorId}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {w.investorName}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums font-medium text-status-overdue">
                      −{formatPKR(w.amount)}
                    </TableCell>
                    <TableCell className="tabular-nums font-semibold">
                      {formatPKR(w.remainingBalance)}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-muted-foreground">
                      {w.reason || "—"}
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