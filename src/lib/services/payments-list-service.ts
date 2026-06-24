import { createClient } from "@/lib/supabase/server";

export class PaymentsListServiceError extends Error {}

export interface PaymentListItem {
  id: number;
  amountPaid: number;
  remainingBalance: number;
  paymentMethod: string | null;
  paymentDate: string;
  remarks: string | null;
  contractId: number;
  contractCode: string;
  clientName: string;
}

export async function listAllPayments(params?: {
  limit?: number;
}): Promise<PaymentListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, amount_paid, remaining_balance, payment_method, payment_date, remarks, contract:contracts(id, contract_code, client:clients(name))"
    )
    .order("payment_date", { ascending: false })
    .limit(params?.limit ?? 100);

  if (error) {
    throw new PaymentsListServiceError(
      `Failed to list payments: ${error.message}`
    );
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    amountPaid: Number(row.amount_paid),
    remainingBalance: Number(row.remaining_balance),
    paymentMethod: row.payment_method,
    paymentDate: row.payment_date,
    remarks: row.remarks,
    contractId: row.contract.id,
    contractCode: row.contract.contract_code,
    clientName: row.contract.client.name,
  }));
}
