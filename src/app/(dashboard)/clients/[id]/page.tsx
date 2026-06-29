import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ContractStatusBadge } from "@/components/shared/status-badge";
import { BlacklistBadge } from "@/components/shared/blacklist-badge";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { getClientById } from "@/lib/services/client-service";
import { BLACKLIST_OVERDUE_MONTHS_THRESHOLD } from "@/lib/utils/calculations";
import { formatDate, formatPKR } from "@/lib/utils/format";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(Number(id));

  if (!client) notFound();

  const maxOverdueMonths = Math.max(
    0,
    ...client.contracts.map((c) => c.overdueMonths)
  );
  const isBlacklisted = maxOverdueMonths >= BLACKLIST_OVERDUE_MONTHS_THRESHOLD;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/clients">
          <ArrowLeft className="h-4 w-4" />
          Back to clients
        </Link>
      </Button>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {client.clientCode}
            </p>
            <CardTitle className="mt-1 text-xl">{client.name}</CardTitle>
            {isBlacklisted && (
              <div className="mt-2">
                <BlacklistBadge maxOverdueMonths={maxOverdueMonths} />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/clients/${client.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </Button>
            <DeleteClientButton clientId={client.id} clientName={client.name} />
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">CNIC</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {client.cnic || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Phone</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {client.phone || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Client Since</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {formatDate(client.createdAt)}
              </dd>
            </div>
            <div className="sm:col-span-3">
              <dt className="text-xs text-muted-foreground">Address</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {client.address || "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Contracts</CardTitle>
          <Button size="sm" asChild>
            <Link href={`/contracts/new?clientId=${client.id}`}>
              <Plus className="h-4 w-4" />
              New Contract
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {client.contracts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                This client has no contracts yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {client.contracts.map((contract) => (
                <Link
                  key={contract.id}
                  href={`/contracts/${contract.id}`}
                  className="flex items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-muted/40"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {contract.contractCode} · {contract.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Started {formatDate(contract.startDate)} ·{" "}
                      {contract.numberOfInstallments} installments
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatPKR(contract.remainingBalance)} left
                    </span>
                    <ContractStatusBadge status={contract.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}