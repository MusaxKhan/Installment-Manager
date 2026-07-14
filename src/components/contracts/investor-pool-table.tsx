import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPKR } from "@/lib/utils/format";
import type { ContractInvestorSnapshotWithInvestor } from "@/types/domain";

export function InvestorPoolTable({
  snapshot,
}: {
  snapshot: ContractInvestorSnapshotWithInvestor[];
}) {
  if (snapshot.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No investor pool is locked in for this contract yet.
      </p>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Investor</TableHead>
            <TableHead>Locked-in Investment</TableHead>
            <TableHead>Share of this Contract</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {snapshot.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-foreground">
                {row.investorName}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {row.investmentAmount > 0 ? formatPKR(row.investmentAmount) : "—"}
              </TableCell>
              <TableCell className="tabular-nums font-medium text-foreground">
                {row.percentOfPool.toFixed(2)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="border-t border-border px-3 py-3 text-xs text-muted-foreground">
        Locked in when this contract was created. Investors who join or add
        capital afterward never affect this contract&apos;s profit split.
      </p>
    </div>
  );
}