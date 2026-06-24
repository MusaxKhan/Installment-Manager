import { Badge } from "@/components/ui/badge";
import type { ContractStatus, InstallmentStatus } from "@/types/domain";

const CONTRACT_LABELS: Record<ContractStatus, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  OVERDUE: "Overdue",
};

const CONTRACT_VARIANTS: Record<
  ContractStatus,
  "active" | "completed" | "overdue"
> = {
  ACTIVE: "active",
  COMPLETED: "completed",
  OVERDUE: "overdue",
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <Badge variant={CONTRACT_VARIANTS[status]}>{CONTRACT_LABELS[status]}</Badge>
  );
}

const INSTALLMENT_LABELS: Record<InstallmentStatus, string> = {
  PENDING: "Pending",
  PARTIAL: "Partial",
  PAID: "Paid",
  OVERDUE: "Overdue",
};

const INSTALLMENT_VARIANTS: Record<
  InstallmentStatus,
  "pending" | "partial" | "completed" | "overdue"
> = {
  PENDING: "pending",
  PARTIAL: "partial",
  PAID: "completed",
  OVERDUE: "overdue",
};

export function InstallmentStatusBadge({
  status,
}: {
  status: InstallmentStatus;
}) {
  return (
    <Badge variant={INSTALLMENT_VARIANTS[status]}>
      {INSTALLMENT_LABELS[status]}
    </Badge>
  );
}
