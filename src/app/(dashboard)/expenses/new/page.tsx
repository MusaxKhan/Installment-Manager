import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BusinessExpenseForm } from "@/components/expenses/business-expense-form";

export default function NewExpensePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/expenses">
          <ArrowLeft className="h-4 w-4" />
          Back to expenses
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>New Business Expense</CardTitle>
        </CardHeader>
        <CardContent>
          <BusinessExpenseForm />
        </CardContent>
      </Card>
    </div>
  );
}