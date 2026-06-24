import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContractForm } from "@/components/contracts/contract-form";
import { getClientsForPicker } from "@/lib/actions/client-picker-actions";

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const clients = await getClientsForPicker();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/contracts">
          <ArrowLeft className="h-4 w-4" />
          Back to contracts
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>New Contract</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractForm
            clients={clients}
            defaultClientId={clientId ? Number(clientId) : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
