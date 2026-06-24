import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvestorForm } from "@/components/investors/investor-form";
import { createInvestorAction } from "@/lib/actions/investor-actions";

export default function NewInvestorPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/investors">
          <ArrowLeft className="h-4 w-4" />
          Back to investors
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>New Investor</CardTitle>
        </CardHeader>
        <CardContent>
          <InvestorForm
            action={createInvestorAction}
            submitLabel="Create Investor"
            isCreate
          />
        </CardContent>
      </Card>
    </div>
  );
}
