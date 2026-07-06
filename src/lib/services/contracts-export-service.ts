import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import type { ContractStatus, InstallmentStatus } from "@/types/database";

export class ContractsExportServiceError extends Error {}

export interface ExportInstallment {
  installmentNumber: number;
  dueDate: string;
  installmentAmount: number;
  status: InstallmentStatus;
}

export interface ExportContract {
  id: number;
  contractCode: string;
  startDate: string;
  clientName: string;
  clientCode: string;
  productName: string;
  productDescription: string | null;
  purchasePrice: number;
  totalPrice: number;
  profitPercent: number;
  remainingBalance: number;
  installments: ExportInstallment[];
}

/**
 * Fetches everything the contracts Excel export needs in two queries
 * (contracts+client, then all their installments) rather than one
 * query per contract.
 */
export async function getContractsForExport(
  status?: ContractStatus
): Promise<ExportContract[]> {
  const supabase = await createClient();

  let contractsQuery = supabase
    .from("contracts")
    .select(
      "id, contract_code, start_date, purchase_price, total_price, profit_percent, remaining_balance, product_name, product_description, client:clients(name, client_code)"
    )
    .order("start_date", { ascending: true });

  if (status) {
    contractsQuery = contractsQuery.eq("status", status);
  }

  const { data: contracts, error: contractsError } = await contractsQuery;
  if (contractsError) {
    throw new ContractsExportServiceError(
      `Failed to load contracts for export: ${contractsError.message}`
    );
  }
  if (!contracts || contracts.length === 0) return [];

  const contractIds = contracts.map((c) => c.id);
  const { data: installments, error: installmentsError } = await supabase
    .from("installments")
    .select("contract_id, installment_number, due_date, installment_amount, status")
    .in("contract_id", contractIds)
    .order("installment_number", { ascending: true });

  if (installmentsError) {
    throw new ContractsExportServiceError(
      `Failed to load installments for export: ${installmentsError.message}`
    );
  }

  const installmentsByContract = new Map<number, ExportInstallment[]>();
  for (const inst of installments ?? []) {
    const list = installmentsByContract.get(inst.contract_id) ?? [];
    list.push({
      installmentNumber: inst.installment_number,
      dueDate: inst.due_date,
      installmentAmount: inst.installment_amount,
      status: inst.status,
    });
    installmentsByContract.set(inst.contract_id, list);
  }

  return contracts.map((c) => ({
    id: c.id,
    contractCode: c.contract_code,
    startDate: c.start_date,
    clientName: c.client.name,
    clientCode: c.client.client_code,
    productName: c.product_name,
    productDescription: c.product_description,
    purchasePrice: c.purchase_price,
    totalPrice: c.total_price,
    profitPercent: c.profit_percent,
    remainingBalance: c.remaining_balance,
    installments: installmentsByContract.get(c.id) ?? [],
  }));
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF133864" },
};
const PAID_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFC6EFCE" },
};
const UNPAID_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFC7CE" },
};
const PAID_FONT_COLOR = "FF006100";
const UNPAID_FONT_COLOR = "FF9C0006";
const THIN_BORDER: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFD9D9D9" } };

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Builds the "one complete row per contract" print/export workbook.
 * Installment columns are dynamic — as many as the contract with the
 * most installments in this export needs; contracts with fewer just
 * have blank trailing cells. Each installment cell keeps its amount as
 * a real number (so Subtotal can SUM it) but displays the due month
 * inline via a per-cell custom number format, and is filled green when
 * PAID or red for anything not fully paid (PENDING/PARTIAL/OVERDUE).
 */
export function buildContractsExportWorkbook(
  contracts: ExportContract[],
  filterLabel: string
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sitara Traders";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Contracts", {
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const maxInstallments = contracts.reduce(
    (max, c) => Math.max(max, c.installments.length),
    0
  );

  const fixedHeaders = [
    "Contract ID",
    "Start Date",
    "Customer Name",
    "Customer ID",
    "Item",
    "Purchase Price",
    "Sale Price",
    "Profit %",
  ];
  const installmentHeaders = Array.from(
    { length: maxInstallments },
    (_, i) => `Inst ${i + 1}`
  );
  const headers = [...fixedHeaders, ...installmentHeaders, "Subtotal", "Remaining Balance"];
  const totalCols = headers.length;
  const firstInstallmentCol = fixedHeaders.length + 1;
  const subtotalCol = firstInstallmentCol + maxInstallments;
  const remainingBalanceCol = subtotalCol + 1;

  // Title row
  sheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `Sitara Traders — Contracts Export (${filterLabel}) — Generated ${new Date().toLocaleString(
    "en-PK"
  )}`;
  titleCell.font = { bold: true, size: 13 };
  sheet.getRow(1).height = 22;

  // Legend row
  const legendRow = sheet.getRow(2);
  legendRow.getCell(1).value = "Paid";
  legendRow.getCell(1).fill = PAID_FILL;
  legendRow.getCell(1).font = { color: { argb: PAID_FONT_COLOR }, bold: true };
  legendRow.getCell(2).value = "Unpaid / Overdue";
  legendRow.getCell(2).fill = UNPAID_FILL;
  legendRow.getCell(2).font = { color: { argb: UNPAID_FONT_COLOR }, bold: true };

  // Header row (row 4)
  const headerRowNumber = 4;
  const headerRow = sheet.getRow(headerRowNumber);
  headers.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
  });
  headerRow.height = 20;
  sheet.views = [{ state: "frozen", ySplit: headerRowNumber, xSplit: 4 }];
  sheet.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;

  let rowNum = headerRowNumber + 1;
  for (const contract of contracts) {
    const row = sheet.getRow(rowNum);

    row.getCell(1).value = contract.contractCode;
    row.getCell(2).value = new Date(contract.startDate);
    row.getCell(2).numFmt = "dd-mmm-yyyy";
    row.getCell(3).value = contract.clientName;
    row.getCell(4).value = contract.clientCode;
    row.getCell(5).value = contract.productDescription
      ? `${contract.productName} (${contract.productDescription})`
      : contract.productName;
    row.getCell(6).value = contract.purchasePrice;
    row.getCell(6).numFmt = '"Rs. "#,##0';
    row.getCell(7).value = contract.totalPrice;
    row.getCell(7).numFmt = '"Rs. "#,##0';
    row.getCell(8).value = contract.profitPercent;
    row.getCell(8).numFmt = '0.0"%"';

    contract.installments.forEach((inst, idx) => {
      const cell = row.getCell(firstInstallmentCol + idx);
      cell.value = inst.installmentAmount;
      const due = new Date(inst.dueDate);
      const monthLabel = `${MONTH_ABBR[due.getMonth()]} '${String(due.getFullYear()).slice(2)}`;
      cell.numFmt = `#,##0" – ${monthLabel}"`;
      const isPaid = inst.status === "PAID";
      cell.fill = isPaid ? PAID_FILL : UNPAID_FILL;
      cell.font = { color: { argb: isPaid ? PAID_FONT_COLOR : UNPAID_FONT_COLOR } };
    });

    const firstInstLetter = sheet.getColumn(firstInstallmentCol).letter;
    const lastInstLetter = sheet.getColumn(firstInstallmentCol + maxInstallments - 1).letter;
    const subtotalCell = row.getCell(subtotalCol);
    subtotalCell.value =
      maxInstallments > 0
        ? { formula: `SUM(${firstInstLetter}${rowNum}:${lastInstLetter}${rowNum})` }
        : 0;
    subtotalCell.numFmt = '"Rs. "#,##0';
    subtotalCell.font = { bold: true };

    const remainingCell = row.getCell(remainingBalanceCol);
    remainingCell.value = contract.remainingBalance;
    remainingCell.numFmt = '"Rs. "#,##0';
    remainingCell.font = {
      bold: true,
      color: { argb: contract.remainingBalance > 0 ? UNPAID_FONT_COLOR : PAID_FONT_COLOR },
    };

    for (let c = 1; c <= totalCols; c++) {
      row.getCell(c).border = {
        top: THIN_BORDER,
        bottom: THIN_BORDER,
        left: THIN_BORDER,
        right: THIN_BORDER,
      };
    }

    rowNum += 1;
  }

  sheet.getColumn(1).width = 14;
  sheet.getColumn(2).width = 13;
  sheet.getColumn(3).width = 20;
  sheet.getColumn(4).width = 14;
  sheet.getColumn(5).width = 26;
  sheet.getColumn(6).width = 14;
  sheet.getColumn(7).width = 14;
  sheet.getColumn(8).width = 10;
  for (let i = 0; i < maxInstallments; i++) {
    sheet.getColumn(firstInstallmentCol + i).width = 16;
  }
  sheet.getColumn(subtotalCol).width = 15;
  sheet.getColumn(remainingBalanceCol).width = 17;

  return workbook;
}