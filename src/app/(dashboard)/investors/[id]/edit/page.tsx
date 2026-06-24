import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvestorForm } from "@/components/investors/investor-form";
import { updateInvestorAction } from "@/lib/actions/investor-actions";
import { getInvestorWithBalance } from "@/lib/services/investor-service";

export default async function EditInvestorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const investor = await getInvestorWithBalance(Number(id));

  if (!investor) notFound();

  const boundAction = updateInvestorAction.bind(null, investor.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/investors/${investor.id}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to investor
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit {investor.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <InvestorForm
            action={boundAction}
            defaultValues={investor}
            submitLabel="Save Changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
