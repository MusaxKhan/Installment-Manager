import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InstallmentStatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import { formatDate, formatPKR } from "@/lib/utils/format";
import type { Installment } from "@/types/domain";

export function InstallmentTable({
  installments,
}: {
  installments: Installment[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Paid</TableHead>
          <TableHead>Remaining</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {installments.map((inst) => (
          <TableRow
            key={inst.id}
            className={cn(
              inst.status === "OVERDUE" && "bg-status-overdue-bg/40"
            )}
          >
            <TableCell className="text-muted-foreground">
              {inst.installmentNumber}
            </TableCell>
            <TableCell
              className={cn(
                inst.status === "OVERDUE" && "font-medium text-status-overdue"
              )}
            >
              {formatDate(inst.dueDate)}
            </TableCell>
            <TableCell className="tabular-nums">
              {formatPKR(inst.installmentAmount)}
            </TableCell>
            <TableCell className="tabular-nums text-status-completed">
              {inst.paidAmount > 0 ? formatPKR(inst.paidAmount) : "—"}
            </TableCell>
            <TableCell className="tabular-nums font-medium">
              {inst.remainingAmount > 0 ? formatPKR(inst.remainingAmount) : "—"}
            </TableCell>
            <TableCell>
              <InstallmentStatusBadge status={inst.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
