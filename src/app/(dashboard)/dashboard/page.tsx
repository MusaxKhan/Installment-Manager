import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  Users,
  Landmark,
  TrendingUp,
  Wallet,
  Coins,
  AlertCircle,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { ContractStatusBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardStats } from "@/lib/services/dashboard-service";
import { listContracts } from "@/lib/services/contract-service";
import { getActiveBusinessPhase } from "@/lib/services/business-phase-service";
import { formatPKR, formatDate } from "@/lib/utils/format";

export default async function DashboardPage() {
  const [stats, overdueContracts, activePhase] = await Promise.all([
    getDashboardStats(),
    listContracts({ status: "OVERDUE" }),
    getActiveBusinessPhase(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          A snapshot of where the business stands today.
        </p>
      </div>

      {!activePhase && (
        <Card className="border-status-partial/40 bg-status-partial-bg">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-status-partial" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                No active business phase
              </p>
              <p className="text-xs text-muted-foreground">
                Contracts that complete right now won&apos;t be able to
                distribute profit until you create a phase and add
                investor investments to it.
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/phases/new">Create Phase</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Active Contracts"
          value={String(stats.totalActiveContracts)}
          icon={FileText}
        />
        <StatCard
          label="Outstanding Amount"
          value={formatPKR(stats.totalOutstandingAmount)}
          icon={Wallet}
          hint="Across active & overdue contracts"
        />
        <StatCard
          label="Overdue Contracts"
          value={String(stats.totalOverdueContracts)}
          icon={AlertTriangle}
          tone="overdue"
        />
        <StatCard
          label="Total Clients"
          value={String(stats.totalClients)}
          icon={Users}
        />
        <StatCard
          label="Total Investors"
          value={String(stats.totalInvestors)}
          icon={Landmark}
        />
        <StatCard
          label="Profit Generated"
          value={formatPKR(stats.totalProfitGenerated)}
          icon={TrendingUp}
          tone="completed"
          hint="From completed contracts only"
        />
        <StatCard
          label="Profit Distributed"
          value={formatPKR(stats.totalProfitDistributed)}
          icon={Coins}
          tone="completed"
          hint="Paid out to investors so far"
        />
        <StatCard
          label="Active Phase Investment"
          value={formatPKR(stats.activePhaseInvestmentTotal)}
          icon={Landmark}
          hint={activePhase ? activePhase.phaseName : "No active phase"}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Overdue Contracts</CardTitle>
            <CardDescription>
              These need follow-up — sorted by most recently flagged.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/contracts?status=OVERDUE">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {overdueContracts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No overdue contracts right now. Nice work.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {overdueContracts.slice(0, 6).map((contract) => (
                <Link
                  key={contract.id}
                  href={`/contracts/${contract.id}`}
                  className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-muted/40"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {contract.client.name}{" "}
                      <span className="text-muted-foreground">
                        · {contract.contractCode}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {contract.productName} · {contract.overdueMonths}{" "}
                      {contract.overdueMonths === 1 ? "month" : "months"}{" "}
                      overdue · started {formatDate(contract.startDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums text-status-overdue">
                      {formatPKR(contract.remainingBalance)}
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
