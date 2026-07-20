import { ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listCashLedgerEntries,
  getCashInHand,
} from "@/lib/services/cash-ledger-service";
import { formatDate, formatPKR } from "@/lib/utils/format";
import type { CashLedgerEntryType } from "@/lib/services/cash-ledger-service";

const ENTRY_LABELS: Record<CashLedgerEntryType, string> = {
  investment: "Investor investment",
  loan: "Loan taken",
  payment_received: "Payment received",
  purchase: "Contract purchase",
  withdrawal: "Investor withdrawal",
  loan_repayment: "Loan repayment",
  business_expense: "Business expense",
};

const CASH_IN_TYPES: CashLedgerEntryType[] = ["investment", "loan", "payment_received"];

export default async function CashLedgerPage() {
  const [entries, cashInHand] = await Promise.all([
    listCashLedgerEntries({ limit: 200 }),
    getCashInHand(),
  ]);

  // Entries come back newest-first; compute each row's running balance
  // by walking backwards from the current total.
  let runningBalance = cashInHand;
  const rowsWithBalance = entries.map((entry) => {
    const balanceAfter = runningBalance;
    runningBalance = runningBalance - entry.amount;
    return { ...entry, balanceAfter };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Cash Ledger</h1>
        <p className="text-sm text-muted-foreground">
          Every movement of cash in or out of the business, in order —
          this is where the Cash in Hand number on your dashboard comes
          from.
        </p>
      </div>

      <Card className="border-status-completed/40 bg-status-completed-bg">
        <CardContent className="flex items-center gap-3 p-5">
          <Wallet className="h-6 w-6 text-status-completed" />
          <div>
            <p className="text-xs text-muted-foreground">
              Current Cash in Hand
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatPKR(cashInHand)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Movements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rowsWithBalance.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No cash movements recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Cash in Hand</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsWithBalance.map((entry) => {
                  const isCashIn = CASH_IN_TYPES.includes(entry.entryType);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDate(entry.entryDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isCashIn ? "completed" : "overdue"}>
                          <span className="flex items-center gap-1">
                            {isCashIn ? (
                              <ArrowUpCircle className="h-3 w-3" />
                            ) : (
                              <ArrowDownCircle className="h-3 w-3" />
                            )}
                            {ENTRY_LABELS[entry.entryType]}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-muted-foreground">
                        {entry.description ?? "—"}
                      </TableCell>
                      <TableCell
                        className={`tabular-nums font-medium ${
                          isCashIn ? "text-status-completed" : "text-status-overdue"
                        }`}
                      >
                        {isCashIn ? "+" : ""}
                        {formatPKR(entry.amount)}
                      </TableCell>
                      <TableCell className="tabular-nums font-semibold">
                        {formatPKR(entry.balanceAfter)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}