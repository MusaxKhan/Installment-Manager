import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoanForm } from "@/components/loans/loan-form";

export default function NewLoanPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/loans">
          <ArrowLeft className="h-4 w-4" />
          Back to loans
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>New Loan</CardTitle>
        </CardHeader>
        <CardContent>
          <LoanForm />
        </CardContent>
      </Card>
    </div>
  );
}