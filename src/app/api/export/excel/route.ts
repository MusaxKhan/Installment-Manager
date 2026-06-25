import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { createClient } from "@/lib/supabase/server";
import type { ContractStatus } from "@/types/database";

export async function GET(request: Request) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);

  const phaseId = searchParams.get("phaseId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");

  // ----------------------------
  // Contracts Query
  // ----------------------------

  let contractsQuery = supabase
    .from("contracts")
    .select(`
        *,
        clients (
        name,
        client_code
        ),
        business_phases (
        phase_name
        )
    `);

  if (phaseId && phaseId !== "all") {
    contractsQuery = contractsQuery.eq(
      "phase_id",
      Number(phaseId)
    );
  }

  if (status && status !== "all") {
    contractsQuery = contractsQuery.eq(
        "status",
        status as ContractStatus
    );
  }

  if (from) {
    contractsQuery = contractsQuery.gte(
      "start_date",
      from
    );
  }

  if (to) {
    contractsQuery = contractsQuery.lte(
      "start_date",
      to
    );
  }

  const [
    clients,
    contracts,
    installments,
    payments,
    paymentEdits,
    investors,
    phases,
    investments,
    distributions,
    withdrawals,
    users,
  ] = await Promise.all([
    supabase.from("clients").select("*"),
    contractsQuery,
    supabase.from("installments").select("*"),
    supabase
    .from("payments")
    .select(`
        *,
        contracts (
        contract_code
        )
    `),
    supabase.from("payment_edits").select("*"),
    supabase.from("investors").select("*"),
    supabase.from("business_phases").select("*"),
    supabase.from("investor_phase_investments").select("*"),
    supabase.from("profit_distributions").select("*"),
    supabase.from("withdrawals").select("*"),
    supabase.from("user_profiles").select("*"),
  ]);

  const workbook = XLSX.utils.book_new();

  // ----------------------------
  // Executive Summary Sheet
  // ----------------------------

  const summaryData = [
  {
    Metric: "Generated At",
    Value: new Date().toLocaleString(),
  },
  {
    Metric: "Contracts",
    Value: contracts.data?.length ?? 0,
  },
  {
    Metric: "Clients",
    Value: clients.data?.length ?? 0,
  },
  {
    Metric: "Investors",
    Value: investors.data?.length ?? 0,
  },
  {
    Metric: "Total Outstanding",
    Value:
      (contracts.data ?? []).reduce(
        (sum: number, c: any) =>
          sum +
          Number(
            c.remaining_balance ?? 0
          ),
        0
      ),
  },
  {
    Metric: "Total Profit",
    Value:
      (contracts.data ?? []).reduce(
        (sum: number, c: any) =>
          sum +
          Number(
            c.profit_amount ?? 0
          ),
        0
      ),
  },
];

  const summarySheet =
    XLSX.utils.json_to_sheet(summaryData);

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    "Executive Summary"
  );

  // ----------------------------
  // Helper
  // ----------------------------

  const addSheet = (
    name: string,
    data: unknown[]
  ) => {
    const worksheet =
      XLSX.utils.json_to_sheet(data ?? []);

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      name
    );
  };

  // ----------------------------
  // Sheets
  // ----------------------------

  const readableContracts =
  (contracts.data ?? []).map((c: any) => ({
    ContractCode: c.contract_code,
    ClientName: c.clients?.name,
    ClientCode: c.clients?.client_code,
    Product: c.product_name,
    PurchasePrice: c.purchase_price,
    TotalPrice: c.total_price,
    RemainingBalance: c.remaining_balance,
    Status: c.status,
    Phase: c.business_phases?.phase_name,
    StartDate: c.start_date,
    ExpectedEndDate: c.expected_end_date,
  }));

  const readablePayments =
  (payments.data ?? []).map((p: any) => ({
    ContractCode:
      p.contracts?.contract_code,
    AmountPaid:
      p.amount_paid,
    RemainingBalance:
      p.remaining_balance,
    PaymentMethod:
      p.payment_method,
    PaymentDate:
      p.payment_date,
    Remarks:
      p.remarks,
  }));

  addSheet("Clients", clients.data ?? []);
  addSheet(
    "Contracts",
    readableContracts
    );
  addSheet("Installments", installments.data ?? []);
  addSheet(
    "Payments",
    readablePayments
    );
  addSheet("Payment Edits", paymentEdits.data ?? []);
  addSheet("Investors", investors.data ?? []);
  addSheet("Business Phases", phases.data ?? []);
  addSheet(
    "Phase Investments",
    investments.data ?? []
  );
  addSheet(
    "Profit Distributions",
    distributions.data ?? []
  );
  addSheet(
    "Withdrawals",
    withdrawals.data ?? []
  );
  addSheet(
    "User Profiles",
    users.data ?? []
  );

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  const today =
    new Date().toISOString().split("T")[0];

  let fileName =
    `Sitara-Traders-Export-${today}.xlsx`;

  if (
    phaseId &&
    phaseId !== "all"
  ) {
    fileName =
      `Sitara-Traders-Phase-${phaseId}-${today}.xlsx`;
  }

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="${fileName}"`,
    },
  });
}