import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { createClient } from "@/lib/supabase/server";
import { buildExportFilename } from "@/lib/utils/export-filename";
import type { ContractStatus } from "@/types/database";

type ReportType = "FULL" | "COLLECTIONS" | "INVESTORS" | "PHASE";

// Which sheets each report type includes. "Full Backup" is the only one
// that also includes admin/account data (User Profiles) — the other
// report types are scoped to what their name promises, so a
// "Collections Report" doesn't quietly also contain investor
// withdrawals, and an "Investor Report" doesn't contain client CNICs.
const REPORT_SHEETS: Record<ReportType, string[]> = {
  FULL: [
    "Clients",
    "Contracts",
    "Installments",
    "Payments",
    "Payment Edits",
    "Investors",
    "Business Phases",
    "Phase Investments",
    "Profit Distributions",
    "Withdrawals",
    "User Profiles",
  ],
  COLLECTIONS: ["Clients", "Contracts", "Installments", "Payments", "Payment Edits"],
  INVESTORS: [
    "Investors",
    "Business Phases",
    "Phase Investments",
    "Profit Distributions",
    "Withdrawals",
  ],
  PHASE: [
    "Business Phases",
    "Contracts",
    "Installments",
    "Payments",
    "Phase Investments",
    "Profit Distributions",
  ],
};

export async function GET(request: Request) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);

  const phaseId = searchParams.get("phaseId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");
  const reportTypeParam = searchParams.get("reportType");
  const reportType: ReportType =
    reportTypeParam && reportTypeParam in REPORT_SHEETS
      ? (reportTypeParam as ReportType)
      : "FULL";

  const includeSheet = (name: string) => REPORT_SHEETS[reportType].includes(name);

  const hasActiveFilter = Boolean(
    (phaseId && phaseId !== "all") || (status && status !== "all") || from || to
  );
  // A "Full Backup" with no filters at all should be a literal, complete
  // dump — every client/installment/payment, even ones with no bearing
  // on any contract in view. The moment either a report type narrows
  // things (anything but FULL) or an explicit filter is chosen, every
  // included sheet gets scoped to the same contract set so the export
  // is internally consistent (previously Contracts respected filters
  // but Installments/Payments/Clients silently didn't).
  const shouldScopeToContracts = reportType !== "FULL" || hasActiveFilter;

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

  const needsContracts =
    includeSheet("Contracts") ||
    includeSheet("Installments") ||
    includeSheet("Payments") ||
    includeSheet("Payment Edits") ||
    includeSheet("Clients");

  const contracts = needsContracts
    ? await contractsQuery
    : { data: [], error: null };

  const contractIds = (contracts.data ?? []).map((c) => c.id);

  // Installments / Payments: scoped to the filtered contract set once
  // any narrowing is active; otherwise (true Full Backup) unfiltered.
  let installmentsQuery = supabase.from("installments").select("*");
  if (shouldScopeToContracts) {
    installmentsQuery = installmentsQuery.in(
      "contract_id",
      contractIds.length > 0 ? contractIds : [-1]
    );
  }

  let paymentsQuery = supabase.from("payments").select(`
        *,
        contracts (
        contract_code
        )
    `);
  if (shouldScopeToContracts) {
    paymentsQuery = paymentsQuery.in(
      "contract_id",
      contractIds.length > 0 ? contractIds : [-1]
    );
  }

  // Clients: scoped to clients who appear in the filtered contract set
  // (dedup'd) once narrowing is active; otherwise every client on file.
  const clientIds = shouldScopeToContracts
    ? Array.from(new Set((contracts.data ?? []).map((c) => c.client_id)))
    : null;
  let clientsQuery = supabase.from("clients").select("*");
  if (clientIds) {
    clientsQuery = clientsQuery.in("id", clientIds.length > 0 ? clientIds : [-1]);
  }

  // Business Phases / Phase Investments / Profit Distributions: scoped
  // to the chosen phase, when one is chosen.
  let phasesQuery = supabase.from("business_phases").select("*");
  let investmentsQuery = supabase.from("investor_phase_investments").select("*");
  let distributionsQuery = supabase.from("profit_distributions").select("*");
  if (phaseId && phaseId !== "all") {
    phasesQuery = phasesQuery.eq("id", Number(phaseId));
    investmentsQuery = investmentsQuery.eq("phase_id", Number(phaseId));
    distributionsQuery = distributionsQuery.eq("phase_id", Number(phaseId));
  }

  const [
    clients,
    installments,
    payments,
    investors,
    phases,
    investments,
    distributions,
    withdrawals,
    users,
  ] = await Promise.all([
    includeSheet("Clients") ? clientsQuery : Promise.resolve({ data: [], error: null }),
    includeSheet("Installments")
      ? installmentsQuery
      : Promise.resolve({ data: [], error: null }),
    includeSheet("Payments") ? paymentsQuery : Promise.resolve({ data: [], error: null }),
    includeSheet("Investors")
      ? supabase.from("investors").select("*")
      : Promise.resolve({ data: [], error: null }),
    includeSheet("Business Phases")
      ? phasesQuery
      : Promise.resolve({ data: [], error: null }),
    includeSheet("Phase Investments")
      ? investmentsQuery
      : Promise.resolve({ data: [], error: null }),
    includeSheet("Profit Distributions")
      ? distributionsQuery
      : Promise.resolve({ data: [], error: null }),
    includeSheet("Withdrawals")
      ? supabase.from("withdrawals").select("*")
      : Promise.resolve({ data: [], error: null }),
    includeSheet("User Profiles")
      ? supabase.from("user_profiles").select("*")
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Payment Edits: scoped to the payments actually included above.
  let paymentEdits: { data: unknown[] | null; error: unknown } = { data: [], error: null };
  if (includeSheet("Payment Edits")) {
    const paymentIds = (payments.data ?? []).map((p: { id: number }) => p.id);
    paymentEdits = shouldScopeToContracts
      ? await supabase
          .from("payment_edits")
          .select("*")
          .in("payment_id", paymentIds.length > 0 ? paymentIds : [-1])
      : await supabase.from("payment_edits").select("*");
  }

  const workbook = XLSX.utils.book_new();

  // ----------------------------
  // Executive Summary Sheet
  // ----------------------------

  const summaryData = [
  {
    Metric: "Report Type",
    Value: reportType,
  },
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
        (sum: number, c: { remaining_balance: number | null }) =>
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
        (sum: number, c: { profit_amount: number | null }) =>
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
    if (!includeSheet(name)) return;
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

  interface ContractExportRow {
    contract_code: string;
    product_name: string;
    purchase_price: number;
    total_price: number;
    remaining_balance: number;
    status: string;
    start_date: string;
    expected_end_date: string | null;
    clients: { name: string; client_code: string } | null;
    business_phases: { phase_name: string } | null;
  }

  interface PaymentExportRow {
    amount_paid: number;
    remaining_balance: number;
    payment_method: string | null;
    payment_date: string;
    remarks: string | null;
    contracts: { contract_code: string } | null;
  }

  const readableContracts =
  (contracts.data ?? []).map((c: ContractExportRow) => ({
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
  (payments.data ?? []).map((p: PaymentExportRow) => ({
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

  const fileName = buildExportFilename({
    reportType,
    status,
    phaseLabel: phaseId && phaseId !== "all" ? `Phase${phaseId}` : null,
    from,
    to,
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="${fileName}"`,
    },
  });
}