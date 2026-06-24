import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WithdrawalDialog } from "@/components/investors/withdrawal-dialog";
import { WithdrawalHistoryTable } from "@/components/investors/withdrawal-history-table";
import {
  getInvestorWithBalance,
  getInvestorPhaseHistory,
} from "@/lib/services/investor-service";
import { listDistributionsForInvestor } from "@/lib/services/profit-distribution-service";
import { listWithdrawalsForInvestor } from "@/lib/services/withdrawal-service";
import { formatPKR, formatDateTime } from "@/lib/utils/format";

export default async function InvestorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const investorId = Number(id);

  const investor = await getInvestorWithBalance(investorId);
  if (!investor) notFound();

  const [phaseHistory, distributions, withdrawals] = await Promise.all([
    getInvestorPhaseHistory(investorId),
    listDistributionsForInvestor(investorId),
    listWithdrawalsForInvestor(investorId),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/investors">
          <ArrowLeft className="h-4 w-4" />
          Back to investors
        </Link>
      </Button>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl">{investor.name}</CardTitle>
            <div className="mt-2">
              <Badge variant={investor.active ? "active" : "pending"}>
                {investor.active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/investors/${investor.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Total Invested</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                {formatPKR(investor.totalInvested)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total Distributed</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-status-completed">
                {formatPKR(investor.totalDistributed)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total Withdrawn</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-status-overdue">
                {formatPKR(investor.totalWithdrawn)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Available Balance</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
                {formatPKR(investor.availableBalance)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Investments by Phase</CardTitle>
        </CardHeader>
        <CardContent>
          {phaseHistory.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              This investor hasn&apos;t invested in any phase yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {phaseHistory.map((entry) => (
                <div
                  key={entry.phaseId}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/phases/${entry.phaseId}`}
                      className="text-sm font-medium text-accent hover:underline"
                    >
                      {entry.phaseName}
                    </Link>
                    <Badge variant={entry.phaseStatus === "ACTIVE" ? "active" : "pending"}>
                      {entry.phaseStatus === "ACTIVE" ? "Active" : "Closed"}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    {formatPKR(entry.investmentAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profit Distribution History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {distributions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No profit has been distributed to this investor yet.
            </p>
          ) : (
            <div className="divide-y divide-border px-6">
              {distributions.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <Link
                      href={`/contracts/${d.contractId}`}
                      className="text-sm font-medium text-accent hover:underline"
                    >
                      {d.contractCode}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {d.phaseName ?? "—"} · {formatDateTime(d.createdAt)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-status-completed">
                    {formatPKR(d.profitAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Withdrawal History</CardTitle>
          <WithdrawalDialog
            investorId={investor.id}
            availableBalance={investor.availableBalance}
          />
        </CardHeader>
        <CardContent className="p-0">
          <WithdrawalHistoryTable withdrawals={withdrawals} />
        </CardContent>
      </Card>
    </div>
  );
}
