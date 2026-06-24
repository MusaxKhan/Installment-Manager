import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddInvestmentDialog } from "@/components/phases/add-investment-dialog";
import { RemoveInvestmentButton } from "@/components/phases/remove-investment-button";
import { ClosePhaseButton } from "@/components/phases/close-phase-button";
import {
  getBusinessPhaseById,
  getPhaseInvestments,
} from "@/lib/services/business-phase-service";
import { listInvestors } from "@/lib/services/investor-service";
import { formatDate, formatPercent, formatPKR } from "@/lib/utils/format";

export default async function PhaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const phaseId = Number(id);

  const phase = await getBusinessPhaseById(phaseId);
  if (!phase) notFound();

  const [investments, allInvestors] = await Promise.all([
    getPhaseInvestments(phaseId),
    listInvestors(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/phases">
          <ArrowLeft className="h-4 w-4" />
          Back to phases
        </Link>
      </Button>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl">{phase.phaseName}</CardTitle>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={phase.status === "ACTIVE" ? "active" : "pending"}>
                {phase.status === "ACTIVE" ? "Active" : "Closed"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(phase.startDate)} —{" "}
                {phase.endDate ? formatDate(phase.endDate) : "ongoing"}
              </span>
            </div>
          </div>
          {phase.status === "ACTIVE" && <ClosePhaseButton phaseId={phase.id} />}
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Total Investment</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {formatPKR(phase.totalInvestment)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Investors</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {phase.investorCount}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChart className="h-4 w-4 text-accent" />
            Investor Breakdown
          </CardTitle>
          <AddInvestmentDialog phaseId={phase.id} investors={allInvestors} />
        </CardHeader>
        <CardContent>
          {investments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No investors have invested in this phase yet. Profit can&apos;t
              be distributed until at least one investment is added.
            </p>
          ) : (
            <div className="space-y-3">
              {investments.map((inv) => (
                <div key={inv.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {inv.investorName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatPercent(inv.percentOfPhase)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {formatPKR(inv.investmentAmount)}
                      </span>
                      <RemoveInvestmentButton
                        investmentId={inv.id}
                        phaseId={phase.id}
                        investorName={inv.investorName}
                      />
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.min(100, inv.percentOfPhase)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
