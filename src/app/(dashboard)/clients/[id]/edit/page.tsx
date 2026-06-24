import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/clients/client-form";
import { updateClientAction } from "@/lib/actions/client-actions";
import { getClientById } from "@/lib/services/client-service";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(Number(id));

  if (!client) notFound();

  const boundAction = updateClientAction.bind(null, client.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/clients/${client.id}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to client
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit {client.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientForm
            action={boundAction}
            defaultValues={client}
            defaultClientId={client.id}
            submitLabel="Save Changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
