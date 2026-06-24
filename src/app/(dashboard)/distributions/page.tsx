import Link from "next/link";
import { Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAllDistributions } from "@/lib/services/profit-distribution-service";
import { formatDateTime, formatPKR } from "@/lib/utils/format";

export default async function DistributionsPage() {
  const distributions = await listAllDistributions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Profit Distributions
        </h1>
        <p className="text-sm text-muted-foreground">
          Most recent {distributions.length} distributions across all
          completed contracts
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {distributions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Coins className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No profit has been distributed yet.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Investor</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributions.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{formatDateTime(d.createdAt)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/contracts/${d.contractId}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {d.contractCode}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/investors/${d.investorId}`}
                        className="hover:underline"
                      >
                        {d.investorName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.phaseName ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums font-medium text-status-completed">
                      {formatPKR(d.profitAmount)}
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
