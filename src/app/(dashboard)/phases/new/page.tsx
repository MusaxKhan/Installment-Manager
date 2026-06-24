import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BusinessPhaseForm } from "@/components/phases/business-phase-form";
import { getActiveBusinessPhase } from "@/lib/services/business-phase-service";

export default async function NewPhasePage() {
  const activePhase = await getActiveBusinessPhase();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/phases">
          <ArrowLeft className="h-4 w-4" />
          Back to phases
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>New Business Phase</CardTitle>
        </CardHeader>
        <CardContent>
          <BusinessPhaseForm hasActivePhase={Boolean(activePhase)} />
        </CardContent>
      </Card>
    </div>
  );
}
