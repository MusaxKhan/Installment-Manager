import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
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

// Chunks an .in(...) filter's id list so a very large export doesn't
// build one oversized filter, independent of the row-count pagination
// that fetchAllRows already handles per page.
const ID_CHUNK_SIZE = 500;
function chunkIds(ids: number[]): number[][] {
  if (ids.length === 0) return [[-1]];
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + ID_CHUNK_SIZE));
  }
  return chunks;
}

/**
 * Fetches every row matching an .in(idColumn, ids) filter across
 * however many id-chunks and row-pages that takes. This is the export
 * route, so "all the data, wherever it's fetched" is the entire point
 * — a bare .select() here would be silently capped at whatever the
 * Supabase project's max_rows is set to (commonly 1000, sometimes
 * lower), with no error, just quietly missing rows past that count.
 */
async function fetchAllForIds<T>(
  ids: number[],
  idColumn: string,
  buildQuery: (
    idChunk: number[],
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const results: T[] = [];
  for (const chunk of chunkIds(ids)) {
    const rows = await fetchAllRows((from, to) => buildQuery(chunk, from, to));
    results.push(...rows);
  }
  return results;
}

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
  // is internally consistent.
  const shouldScopeToContracts = reportType !== "FULL" || hasActiveFilter;

  interface ContractExportRow {
    id: number;
    client_id: number;
    contract_code: string;
    product_name: string;
    purchase_price: number;
    total_price: number;
    remaining_balance: number;
    profit_amount: number;
    status: string;
    start_date: string;
    expected_end_date: string | null;
    clients: { name: string; client_code: string } | null;
    business_phases: { phase_name: string } | null;
  }

  const needsContracts =
    includeSheet("Contracts") ||
    includeSheet("Installments") ||
    includeSheet("Payments") ||
    includeSheet("Payment Edits") ||
    includeSheet("Clients");

  let contracts: ContractExportRow[] = [];
  try {
    if (needsContracts) {
      contracts = await fetchAllRows<ContractExportRow>((rangeFrom, rangeTo) => {
        let query = supabase
          .from("contracts")
          .select(
            `
              *,
              clients (
              name,
              client_code
              ),
              business_phases (
              phase_name
              )
          `
          );

        if (phaseId && phaseId !== "all") {
          query = query.eq("phase_id", Number(phaseId));
        }
        if (status && status !== "all") {
          query = query.eq("status", status as ContractStatus);
        }
        if (from) {
          query = query.gte("start_date", from);
        }
        if (to) {
          query = query.lte("start_date", to);
        }

        return query.range(rangeFrom, rangeTo);
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to load contracts: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }

  const contractIds = contracts.map((c) => c.id);

  interface PaymentExportRow {
    id: number;
    amount_paid: number;
    remaining_balance: number;
    payment_method: string | null;
    payment_date: string;
    remarks: string | null;
    contracts: { contract_code: string } | null;
  }

  let clientsData: Record<string, unknown>[] = [];
  let installmentsData: Record<string, unknown>[] = [];
  let paymentsData: PaymentExportRow[] = [];
  let investorsData: Record<string, unknown>[] = [];
  let phasesData: Record<string, unknown>[] = [];
  let investmentsData: Record<string, unknown>[] = [];
  let distributionsData: Record<string, unknown>[] = [];
  let withdrawalsData: Record<string, unknown>[] = [];
  let usersData: Record<string, unknown>[] = [];

  try {
    [
      clientsData,
      installmentsData,
      paymentsData,
      investorsData,
      phasesData,
      investmentsData,
      distributionsData,
      withdrawalsData,
      usersData,
    ] = await Promise.all([
      // Clients: scoped to clients who appear in the filtered contract
      // set (dedup'd) once narrowing is active; otherwise every client.
      includeSheet("Clients")
        ? shouldScopeToContracts
          ? fetchAllForIds(
              Array.from(new Set(contracts.map((c) => c.client_id))),
              "id",
              (chunk, rangeFrom, rangeTo) =>
                supabase.from("clients").select("*").in("id", chunk).range(rangeFrom, rangeTo)
            )
          : fetchAllRows((rangeFrom, rangeTo) =>
              supabase.from("clients").select("*").range(rangeFrom, rangeTo)
            )
        : Promise.resolve([]),

      // Installments / Payments: scoped to the filtered contract set
      // once any narrowing is active; otherwise (true Full Backup)
      // unfiltered.
      includeSheet("Installments")
        ? shouldScopeToContracts
          ? fetchAllForIds(contractIds, "contract_id", (chunk, rangeFrom, rangeTo) =>
              supabase
                .from("installments")
                .select("*")
                .in("contract_id", chunk)
                .range(rangeFrom, rangeTo)
            )
          : fetchAllRows((rangeFrom, rangeTo) =>
              supabase.from("installments").select("*").range(rangeFrom, rangeTo)
            )
        : Promise.resolve([]),

      includeSheet("Payments")
        ? shouldScopeToContracts
          ? fetchAllForIds<PaymentExportRow>(
              contractIds,
              "contract_id",
              (chunk, rangeFrom, rangeTo) =>
                supabase
                  .from("payments")
                  .select("*, contracts(contract_code)")
                  .in("contract_id", chunk)
                  .range(rangeFrom, rangeTo)
            )
          : fetchAllRows<PaymentExportRow>((rangeFrom, rangeTo) =>
              supabase
                .from("payments")
                .select("*, contracts(contract_code)")
                .range(rangeFrom, rangeTo)
            )
        : Promise.resolve([]),

      includeSheet("Investors")
        ? fetchAllRows((rangeFrom, rangeTo) =>
            supabase.from("investors").select("*").range(rangeFrom, rangeTo)
          )
        : Promise.resolve([]),

      includeSheet("Business Phases")
        ? fetchAllRows((rangeFrom, rangeTo) => {
            let query = supabase.from("business_phases").select("*");
            if (phaseId && phaseId !== "all") {
              query = query.eq("id", Number(phaseId));
            }
            return query.range(rangeFrom, rangeTo);
          })
        : Promise.resolve([]),

      includeSheet("Phase Investments")
        ? fetchAllRows((rangeFrom, rangeTo) => {
            let query = supabase.from("investor_phase_investments").select("*");
            if (phaseId && phaseId !== "all") {
              query = query.eq("phase_id", Number(phaseId));
            }
            return query.range(rangeFrom, rangeTo);
          })
        : Promise.resolve([]),

      includeSheet("Profit Distributions")
        ? fetchAllRows((rangeFrom, rangeTo) => {
            let query = supabase.from("profit_distributions").select("*");
            if (phaseId && phaseId !== "all") {
              query = query.eq("phase_id", Number(phaseId));
            }
            return query.range(rangeFrom, rangeTo);
          })
        : Promise.resolve([]),

      includeSheet("Withdrawals")
        ? fetchAllRows((rangeFrom, rangeTo) =>
            supabase.from("withdrawals").select("*").range(rangeFrom, rangeTo)
          )
        : Promise.resolve([]),

      includeSheet("User Profiles")
        ? fetchAllRows((rangeFrom, rangeTo) =>
            supabase.from("user_profiles").select("*").range(rangeFrom, rangeTo)
          )
        : Promise.resolve([]),
    ]);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to build export: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }

  // Payment Edits: scoped to the payments actually included above.
  let paymentEditsData: Record<string, unknown>[] = [];
  if (includeSheet("Payment Edits")) {
    try {
      const paymentIds = paymentsData.map((p) => p.id);
      paymentEditsData = shouldScopeToContracts
        ? await fetchAllForIds(paymentIds, "payment_id", (chunk, rangeFrom, rangeTo) =>
            supabase
              .from("payment_edits")
              .select("*")
              .in("payment_id", chunk)
              .range(rangeFrom, rangeTo)
          )
        : await fetchAllRows((rangeFrom, rangeTo) =>
            supabase.from("payment_edits").select("*").range(rangeFrom, rangeTo)
          );
    } catch (err) {
      return NextResponse.json(
        {
          error: `Failed to load payment edits: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
        { status: 500 }
      );
    }
  }

  const workbook = XLSX.utils.book_new();

  // ----------------------------
  // Executive Summary Sheet
  // ----------------------------

  const summaryData = [
    { Metric: "Report Type", Value: reportType },
    { Metric: "Generated At", Value: new Date().toLocaleString() },
    { Metric: "Contracts", Value: contracts.length },
    { Metric: "Clients", Value: clientsData.length },
    { Metric: "Investors", Value: investorsData.length },
    {
      Metric: "Total Outstanding",
      Value: contracts.reduce((sum, c) => sum + Number(c.remaining_balance ?? 0), 0),
    },
    {
      Metric: "Total Profit",
      Value: contracts.reduce((sum, c) => sum + Number(c.profit_amount ?? 0), 0),
    },
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Executive Summary");

  // ----------------------------
  // Helper
  // ----------------------------

  const addSheet = (name: string, data: unknown[]) => {
    if (!includeSheet(name)) return;
    const worksheet = XLSX.utils.json_to_sheet(data ?? []);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  };

  // ----------------------------
  // Sheets
  // ----------------------------

  const readableContracts = contracts.map((c) => ({
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

  const readablePayments = paymentsData.map((p) => ({
    ContractCode: p.contracts?.contract_code,
    AmountPaid: p.amount_paid,
    RemainingBalance: p.remaining_balance,
    PaymentMethod: p.payment_method,
    PaymentDate: p.payment_date,
    Remarks: p.remarks,
  }));

  addSheet("Clients", clientsData);
  addSheet("Contracts", readableContracts);
  addSheet("Installments", installmentsData);
  addSheet("Payments", readablePayments);
  addSheet("Payment Edits", paymentEditsData);
  addSheet("Investors", investorsData);
  addSheet("Business Phases", phasesData);
  addSheet("Phase Investments", investmentsData);
  addSheet("Profit Distributions", distributionsData);
  addSheet("Withdrawals", withdrawalsData);
  addSheet("User Profiles", usersData);

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
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}