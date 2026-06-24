import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContractStatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import { listContracts } from "@/lib/services/contract-service";
import { formatDate, formatPKR } from "@/lib/utils/format";
import type { ContractStatus } from "@/types/domain";

const TABS: { label: string; value: ContractStatus | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Active", value: "ACTIVE" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Completed", value: "COMPLETED" },
];

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const validStatus =
    status === "ACTIVE" || status === "OVERDUE" || status === "COMPLETED"
      ? status
      : undefined;

  const contracts = await listContracts({ status: validStatus });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Contracts</h1>
          <p className="text-sm text-muted-foreground">
            {contracts.length} {contracts.length === 1 ? "contract" : "contracts"}
          </p>
        </div>
        <Button asChild>
          <Link href="/contracts/new">
            <Plus className="h-4 w-4" />
            New Contract
          </Link>
        </Button>
      </div>

      <div className="flex gap-1 rounded-md bg-muted p-1 w-fit">
        {TABS.map((tab) => (
          <Link
            key={tab.label}
            href={tab.value ? `/contracts?status=${tab.value}` : "/contracts"}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
              validStatus === tab.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {contracts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                No contracts found.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Total Price</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow
                    key={contract.id}
                    className={cn(
                      contract.status === "OVERDUE" && "bg-status-overdue-bg/40"
                    )}
                  >
                    <TableCell>
                      <Link
                        href={`/contracts/${contract.id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {contract.contractCode}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/clients/${contract.client.id}`} className="hover:underline">
                        {contract.client.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contract.productName}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatPKR(contract.totalPrice)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "tabular-nums font-medium",
                        contract.status === "OVERDUE" && "text-status-overdue"
                      )}
                    >
                      {formatPKR(contract.remainingBalance)}
                    </TableCell>
                    <TableCell>
                      <ContractStatusBadge status={contract.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(contract.startDate)}
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
