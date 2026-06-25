import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ContractStatusBadge } from "@/components/shared/status-badge";
import { InstallmentTable } from "@/components/contracts/installment-table";
import { PaymentHistoryTable } from "@/components/payments/payment-history-table";
import { RecordPaymentDialog } from "@/components/payments/record-payment-dialog";
import { PendingPaymentsBanner } from "@/components/payments/pending-payments-banner";
import { DistributeProfitButton } from "@/components/contracts/distribute-profit-button";
import { DistributionHistoryTable } from "@/components/contracts/distribution-history-table";
import { getContractById } from "@/lib/services/contract-service";
import { listPaymentEditsForContract } from "@/lib/services/payment-service";
import { listDistributionsForContract } from "@/lib/services/profit-distribution-service";
import { formatDate, formatPKR, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await getContractById(Number(id));

  if (!contract) notFound();

  const [distributions, editsByPaymentId] = await Promise.all([
    contract.status === "COMPLETED"
      ? listDistributionsForContract(contract.id)
      : Promise.resolve([]),
    listPaymentEditsForContract(contract.id),
  ]);

  const paidCount = contract.installments.filter(
    (i) => i.status === "PAID"
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/contracts">
          <ArrowLeft className="h-4 w-4" />
          Back to contracts
        </Link>
      </Button>

      <Card
        className={cn(
          contract.status === "OVERDUE" && "border-status-overdue/40"
        )}
      >
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {contract.contractCode}
            </p>
            <CardTitle className="mt-1 text-xl">
              {contract.productName}
            </CardTitle>
            <CardDescription>
              <Link
                href={`/clients/${contract.client.id}`}
                className="hover:underline"
              >
                {contract.client.name}
              </Link>{" "}
              · {contract.client.clientCode}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
          <ContractStatusBadge status={contract.status} />

          <Button asChild size="sm" variant="outline">
            <Link href={`/contracts/${contract.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        </div>
          {contract.status === "OVERDUE" && (
            <div className="px-6 pb-4">
              <span className="text-sm font-medium text-status-overdue">
                {contract.overdueMonths}{" "}
                {contract.overdueMonths === 1 ? "month" : "months"} overdue
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Purchase Price</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                {formatPKR(contract.purchasePrice)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Profit ({formatPercent(contract.profitPercent)})
              </dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-status-completed">
                {formatPKR(contract.profitAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total Price</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                {formatPKR(contract.totalPrice)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Remaining Balance</dt>
              <dd
                className={cn(
                  "mt-0.5 text-sm font-semibold tabular-nums",
                  contract.status === "OVERDUE"
                    ? "text-status-overdue"
                    : "text-foreground"
                )}
              >
                {formatPKR(contract.remainingBalance)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Start Date</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {formatDate(contract.startDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Expected End</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {formatDate(contract.expectedEndDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Installments</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {paidCount} of {contract.numberOfInstallments} paid
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Initiated By</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {contract.initiatedBy}
              </dd>
            </div>
          </dl>

          {contract.productDescription && (
            <div>
              <dt className="text-xs text-muted-foreground">Description</dt>
              <dd className="mt-0.5 text-sm text-foreground">
                {contract.productDescription}
              </dd>
            </div>
          )}
        </CardContent>
      </Card>

      {contract.guarantor && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Guarantor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Name</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">
                  {contract.guarantor.name || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">
                  {contract.guarantor.phone || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">CNIC</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">
                  {contract.guarantor.cnic || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Address</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">
                  {contract.guarantor.address || "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Installment Schedule</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <InstallmentTable installments={contract.installments} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Payment History</CardTitle>
          <RecordPaymentDialog
            contractId={contract.id}
            remainingBalance={contract.remainingBalance}
          />
        </CardHeader>
        <CardContent className="space-y-4 p-0">
          <div className="px-6">
            <PendingPaymentsBanner contractId={contract.id} />
          </div>
          <PaymentHistoryTable
            payments={contract.payments}
            contractId={contract.id}
            editsByPaymentId={editsByPaymentId}
            profitDistributed={contract.profitDistributed}
          />
        </CardContent>
      </Card>

      {contract.status === "COMPLETED" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="h-4 w-4 text-status-completed" />
              Profit Distribution
            </CardTitle>
            {!contract.profitDistributed && (
              <DistributeProfitButton contractId={contract.id} />
            )}
          </CardHeader>
          <CardContent className="p-0">
            <DistributionHistoryTable distributions={distributions} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
