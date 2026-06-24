import Link from "next/link";
import { Plus, Landmark } from "lucide-react";
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
import { listInvestorsWithBalances } from "@/lib/services/investor-service";
import { formatPKR } from "@/lib/utils/format";

export default async function InvestorsPage() {
  const investors = await listInvestorsWithBalances();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Investors</h1>
          <p className="text-sm text-muted-foreground">
            {investors.length} {investors.length === 1 ? "investor" : "investors"}{" "}
            on record
          </p>
        </div>
        <Button asChild>
          <Link href="/investors/new">
            <Plus className="h-4 w-4" />
            New Investor
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {investors.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Landmark className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                No investors yet.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link href="/investors/new">Add your first investor</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Invested</TableHead>
                  <TableHead>Total Distributed</TableHead>
                  <TableHead>Available Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investors.map((investor) => (
                  <TableRow key={investor.id}>
                    <TableCell>
                      <Link
                        href={`/investors/${investor.id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {investor.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={investor.active ? "active" : "pending"}>
                        {investor.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatPKR(investor.totalInvested)}
                    </TableCell>
                    <TableCell className="tabular-nums text-status-completed">
                      {formatPKR(investor.totalDistributed)}
                    </TableCell>
                    <TableCell className="tabular-nums font-semibold">
                      {formatPKR(investor.availableBalance)}
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
