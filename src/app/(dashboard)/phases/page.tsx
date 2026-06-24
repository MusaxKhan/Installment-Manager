import Link from "next/link";
import { Plus, CalendarRange } from "lucide-react";
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
import { listBusinessPhases } from "@/lib/services/business-phase-service";
import { formatDate, formatPKR } from "@/lib/utils/format";

export default async function PhasesPage() {
  const phases = await listBusinessPhases();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Business Phases
          </h1>
          <p className="text-sm text-muted-foreground">
            {phases.length} {phases.length === 1 ? "phase" : "phases"} on record
          </p>
        </div>
        <Button asChild>
          <Link href="/phases/new">
            <Plus className="h-4 w-4" />
            New Phase
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {phases.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <CalendarRange className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                No business phases yet.
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Phases are investment periods. Create one, then add
                investor investments to it — profit from completed
                contracts is distributed according to the active phase.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link href="/phases/new">Create your first phase</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phase</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Investment</TableHead>
                  <TableHead>Investors</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phases.map((phase) => (
                  <TableRow key={phase.id}>
                    <TableCell>
                      <Link
                        href={`/phases/${phase.id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {phase.phaseName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={phase.status === "ACTIVE" ? "active" : "pending"}>
                        {phase.status === "ACTIVE" ? "Active" : "Closed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatPKR(phase.totalInvestment)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {phase.investorCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(phase.startDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {phase.endDate ? formatDate(phase.endDate) : "—"}
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
