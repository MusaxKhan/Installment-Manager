import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatPKR } from "@/lib/utils/format";
import type { ProfitDistributionWithDetails } from "@/types/domain";

export function DistributionHistoryTable({
  distributions,
}: {
  distributions: ProfitDistributionWithDetails[];
}) {
  if (distributions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Profit hasn&apos;t been distributed for this contract yet.
      </p>
    );
  }

  const total = distributions.reduce((sum, d) => sum + d.profitAmount, 0);

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Investor</TableHead>
            <TableHead>Phase</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Distributed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {distributions.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium text-foreground">
                {d.investorName}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {d.phaseName ?? "—"}
              </TableCell>
              <TableCell className="tabular-nums font-medium text-status-completed">
                {formatPKR(d.profitAmount)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(d.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t border-border px-3 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          Total distributed
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatPKR(total)}
        </span>
      </div>
    </div>
  );
}
