import { NextRequest, NextResponse } from "next/server";
import {
  getContractsForExport,
  buildContractsExportWorkbook,
} from "@/lib/services/contracts-export-service";
import type { ContractStatus } from "@/types/database";

const VALID_STATUSES: ContractStatus[] = ["ACTIVE", "COMPLETED", "OVERDUE"];
const FILTER_LABELS: Record<ContractStatus, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  OVERDUE: "Overdue",
};

export async function GET(request: NextRequest) {
  const statusParam = request.nextUrl.searchParams.get("status");
  const status =
    statusParam && VALID_STATUSES.includes(statusParam as ContractStatus)
      ? (statusParam as ContractStatus)
      : undefined;

  try {
    const contracts = await getContractsForExport(status);
    const workbook = buildContractsExportWorkbook(
      contracts,
      status ? FILTER_LABELS[status] : "All"
    );
    const buffer = await workbook.xlsx.writeBuffer();

    const today = new Date().toISOString().split("T")[0];
    const fileName = `Sitara-Traders-Contracts-${status ?? "All"}-${today}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown export error" },
      { status: 500 }
    );
  }
}