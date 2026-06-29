"use server";

import { createClient } from "@/lib/supabase/server";
import { BLACKLIST_OVERDUE_MONTHS_THRESHOLD } from "@/lib/utils/calculations";

/**
 * Returns a flat, denormalized snapshot suitable for writing straight
 * into the Dexie cache. Intentionally limited in scope — recent and
 * active records only, not the entire history of the business — since
 * this is a "browse offline" cache, not a full local replica. A 3-user
 * shop's full active dataset is small enough that "recent + active +
 * overdue" comfortably covers what someone would actually need to look
 * up with no signal.
 */
export async function getOfflineSnapshot() {
  const supabase = await createClient();

  const [clientsRes, contractsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("contracts")
      .select("*, client:clients(name)")
      .order("updated_at", { ascending: false })
      .limit(500),
  ]);

  if (clientsRes.error) {
    throw new Error(`Failed to snapshot clients: ${clientsRes.error.message}`);
  }
  if (contractsRes.error) {
    throw new Error(
      `Failed to snapshot contracts: ${contractsRes.error.message}`
    );
  }

  const contractIds = (contractsRes.data ?? []).map((c) => c.id);

  const [installmentsRes, paymentsRes] = contractIds.length
    ? await Promise.all([
        supabase
          .from("installments")
          .select("*")
          .in("contract_id", contractIds),
        supabase
          .from("payments")
          .select("*")
          .in("contract_id", contractIds)
          .order("payment_date", { ascending: false })
          .limit(1000),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (installmentsRes.error) {
    throw new Error(
      `Failed to snapshot installments: ${installmentsRes.error.message}`
    );
  }
  if (paymentsRes.error) {
    throw new Error(`Failed to snapshot payments: ${paymentsRes.error.message}`);
  }

  // Blacklist status needs to consider ALL of a client's contracts, not
  // just whichever 500 most-recently-updated ones made it into the
  // windowed snapshot above — an old, long-overdue contract should
  // still flag a client even if it's fallen out of the recent window.
  const { data: overdueRows, error: overdueError } = await supabase
    .from("contracts")
    .select("client_id, overdue_months")
    .gt("overdue_months", 0);

  if (overdueError) {
    throw new Error(
      `Failed to snapshot overdue contract data: ${overdueError.message}`
    );
  }

  const maxOverdueByClient = new Map<number, number>();
  for (const row of overdueRows ?? []) {
    const current = maxOverdueByClient.get(row.client_id) ?? 0;
    if (row.overdue_months > current) {
      maxOverdueByClient.set(row.client_id, row.overdue_months);
    }
  }

  return {
    clients: (clientsRes.data ?? []).map((c) => {
      const maxOverdueMonths = maxOverdueByClient.get(c.id) ?? 0;
      return {
        id: c.id,
        clientCode: c.client_code,
        name: c.name,
        cnic: c.cnic,
        phone: c.phone,
        address: c.address,
        isDeleted: c.is_deleted,
        updatedAt: c.updated_at,
        syncVersion: c.sync_version,
        maxOverdueMonths,
        isBlacklisted: maxOverdueMonths >= BLACKLIST_OVERDUE_MONTHS_THRESHOLD,
      };
    }),
    contracts: (contractsRes.data ?? []).map((c) => ({
      id: c.id,
      contractCode: c.contract_code,
      clientId: c.client_id,
      clientName: c.client?.name ?? "Unknown client",
      productName: c.product_name,
      productDescription: c.product_description,
      initiatedBy: c.initiated_by,
      purchasePrice: Number(c.purchase_price),
      profitPercent: Number(c.profit_percent),
      profitAmount: Number(c.profit_amount),
      totalPrice: Number(c.total_price),
      numberOfInstallments: c.number_of_installments,
      amountPerInstallment: Number(c.amount_per_installment),
      remainingBalance: Number(c.remaining_balance),
      startDate: c.start_date,
      expectedEndDate: c.expected_end_date,
      status: c.status,
      overdueMonths: c.overdue_months,
      profitDistributed: c.profit_distributed,
      guarantorName: c.guarantor_name,
      guarantorPhone: c.guarantor_phone,
      guarantorAddress: c.guarantor_address,
      guarantorCnic: c.guarantor_cnic,
      updatedAt: c.updated_at,
      syncVersion: c.sync_version,
    })),
    installments: (installmentsRes.data ?? []).map((i) => ({
      id: i.id,
      contractId: i.contract_id,
      installmentNumber: i.installment_number,
      dueDate: i.due_date,
      installmentAmount: Number(i.installment_amount),
      paidAmount: Number(i.paid_amount),
      remainingAmount: Number(i.remaining_amount),
      status: i.status,
      updatedAt: i.updated_at,
    })),
    payments: (paymentsRes.data ?? []).map((p) => ({
      id: p.id,
      contractId: p.contract_id,
      amountPaid: Number(p.amount_paid),
      remainingBalance: Number(p.remaining_balance),
      paymentMethod: p.payment_method,
      remarks: p.remarks,
      paymentDate: p.payment_date,
      updatedAt: p.updated_at,
      syncVersion: p.sync_version,
    })),
  };
}