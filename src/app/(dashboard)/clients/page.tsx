import Link from "next/link";
import { Plus, Users as UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { listClients } from "@/lib/services/client-service";
import { formatDate } from "@/lib/utils/format";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const clients = await listClients({ search: q });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {clients.length} {clients.length === 1 ? "client" : "clients"} on
            record
          </p>
        </div>
        <Button asChild>
          <Link href="/clients/new">
            <Plus className="h-4 w-4" />
            New Client
          </Link>
        </Button>
      </div>

      <form className="max-w-sm">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by name, CNIC, phone, or code..."
        />
      </form>

      <Card>
        <CardContent className="p-0">
          {clients.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <UsersIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                {q ? "No clients match your search." : "No clients yet."}
              </p>
              {!q && (
                <Button asChild size="sm" variant="outline" className="mt-2">
                  <Link href="/clients/new">Add your first client</Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>CNIC</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/clients/${client.id}`}
                        className="block font-medium text-accent hover:underline"
                      >
                        {client.clientCode}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/clients/${client.id}`} className="block">
                        {client.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {client.cnic || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {client.phone || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(client.createdAt)}
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
