"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPKR } from "@/lib/utils/format";

interface CalculationPreviewProps {
  purchasePrice: number;
  profitPercent: number;
  numberOfInstallments: number;
}

export function CalculationPreview({
  purchasePrice,
  profitPercent,
  numberOfInstallments,
}: CalculationPreviewProps) {
  const validPrice = purchasePrice > 0 ? purchasePrice : 0;
  const validPercent = profitPercent >= 0 ? profitPercent : 0;
  const validInstallments = numberOfInstallments > 0 ? numberOfInstallments : 1;

  const profitAmount = Math.round(validPrice * (validPercent / 100) * 100) / 100;
  const totalPrice = Math.round((validPrice + profitAmount) * 100) / 100;
  const amountPerInstallment =
    Math.round((totalPrice / validInstallments) * 100) / 100;

  const rows = [
    { label: "Purchase Price", value: validPrice },
    { label: "Profit Amount", value: profitAmount, accent: true },
    { label: "Total Price", value: totalPrice, bold: true },
    { label: "Per Installment", value: amountPerInstallment },
  ];

  return (
    <Card className="border-accent/30 bg-secondary/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">
          Calculated Automatically
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <span
              className={`tabular-nums text-sm ${
                row.bold ? "font-semibold text-foreground" : "font-medium"
              } ${row.accent ? "text-status-completed" : "text-foreground"}`}
            >
              {formatPKR(row.value)}
            </span>
          </div>
        ))}
        <p className="pt-1 text-xs text-muted-foreground">
          Over {validInstallments}{" "}
          {validInstallments === 1 ? "installment" : "installments"}, last
          installment absorbs any rounding remainder.
        </p>
      </CardContent>
    </Card>
  );
}
