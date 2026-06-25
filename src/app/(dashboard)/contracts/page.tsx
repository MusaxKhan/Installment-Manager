"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, FileText, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { getContractsList } from "@/lib/actions/contract-list-actions";
import { offlineDb } from "@/lib/offline/db";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { formatDate, formatPKR } from "@/lib/utils/format";
import type { ContractStatus } from "@/types/domain";
import type { ContractWithClient } from "@/types/domain";

const TABS: { label: string; value: ContractStatus | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Active", value: "ACTIVE" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Completed", value: "COMPLETED" },
];

interface ContractRow {
  id: number;
  contractCode: string;
  clientId: number;
  clientName: string;
  productName: string;
  totalPrice: number;
  remainingBalance: number;
  status: ContractStatus;
  startDate: string;
}

export default function ContractsPage() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const validStatus =
    status === "ACTIVE" || status === "OVERDUE" || status === "COMPLETED"
      ? status
      : undefined;

  const { isOnline } = useOnlineStatus();
  const [onlineContracts, setOnlineContracts] =
    React.useState<ContractWithClient[] | null>(null);
  const [isLoadingOnline, setIsLoadingOnline] = React.useState(false);

  React.useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    setIsLoadingOnline(true);
    getContractsList(validStatus)
      .then((data) => {
        if (!cancelled) setOnlineContracts(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOnline(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOnline, validStatus]);

  const cachedContracts = useLiveQuery(
    () =>
      offlineDb.contracts
        .filter((c) => !validStatus || c.status === validStatus)
        .toArray(),
    [validStatus]
  );

  const isLoading = isOnline
    ? isLoadingOnline && onlineContracts === null
    : cachedContracts === undefined;

  const rows: ContractRow[] = isOnline
    ? (onlineContracts ?? []).map((c) => ({
        id: c.id,
        contractCode: c.contractCode,
        clientId: c.client.id,
        clientName: c.client.name,
        productName: c.productName,
        totalPrice: c.totalPrice,
        remainingBalance: c.remainingBalance,
        status: c.status,
        startDate: c.startDate,
      }))
    : (cachedContracts ?? []).map((c) => ({
        id: c.id,
        contractCode: c.contractCode,
        clientId: c.clientId,
        clientName: c.clientName,
        productName: c.productName,
        totalPrice: c.totalPrice,
        remainingBalance: c.remainingBalance,
        status: c.status,
        startDate: c.startDate,
      }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Contracts</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "contract" : "contracts"}
          </p>
        </div>
        <Button asChild>
          <Link href="/contracts/new">
            <Plus className="h-4 w-4" />
            New Contract
          </Link>
        </Button>
      </div>

      {!isOnline && (
        <Badge variant="overdue" className="flex w-fit items-center gap-1.5">
          <WifiOff className="h-3.5 w-3.5" />
          Offline — showing cached contracts (most recent 500)
        </Badge>
      )}

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
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          ) : rows.length === 0 ? (
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
                {rows.map((contract) => (
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
                      <Link
                        href={`/clients/${contract.clientId}`}
                        className="hover:underline"
                      >
                        {contract.clientName}
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