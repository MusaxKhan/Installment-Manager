/**
 * Builds a descriptive filename for the "Export Data" center so the
 * tenure of the data (and the filters used) is obvious at a glance
 * instead of every export just being "Sitara-Traders-<today>.xlsx"
 * regardless of what was actually filtered.
 *
 * Pure function (no DOM/Node-only APIs) so it can be used both
 * client-side (export-dialog.tsx, which has the full filter state
 * including phase name) and server-side (api/export/excel/route.ts,
 * as a Content-Disposition fallback for anyone hitting the endpoint
 * directly without going through the dialog).
 */
export interface ExportFilenameParams {
  reportType: string; // "FULL" | "COLLECTIONS" | "INVESTORS" | "PHASE" | ...
  status?: string | null; // "all" | ContractStatus | undefined
  phaseLabel?: string | null; // resolved phase name, or "all"/undefined for no filter
  from?: string | null; // "" / null / YYYY-MM-DD
  to?: string | null; // "" / null / YYYY-MM-DD
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  FULL: "FullBackup",
  COLLECTIONS: "Collections",
  INVESTORS: "Investors",
  PHASE: "PhaseReport",
};

function sanitizeSegment(segment: string): string {
  return segment.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "");
}

export function buildExportFilename({
  reportType,
  status,
  phaseLabel,
  from,
  to,
}: ExportFilenameParams): string {
  const parts = ["Sitara-Traders"];

  parts.push(REPORT_TYPE_LABELS[reportType] ?? (sanitizeSegment(reportType) || "Export"));

  if (status && status !== "all") {
    parts.push(sanitizeSegment(status));
  }

  if (phaseLabel && phaseLabel !== "all") {
    parts.push(`Phase-${sanitizeSegment(phaseLabel)}`);
  }

  const hasFrom = Boolean(from);
  const hasTo = Boolean(to);

  let dateSegment: string;
  if (hasFrom && hasTo && from === to) {
    dateSegment = `On-${from}`;
  } else if (hasFrom && hasTo) {
    // Guard against a reversed range (from after to) rather than
    // silently emitting a nonsensical "later_to_earlier" filename.
    dateSegment = from! <= to! ? `${from}_to_${to}` : `${to}_to_${from}`;
  } else if (hasFrom) {
    dateSegment = `From-${from}`;
  } else if (hasTo) {
    dateSegment = `Until-${to}`;
  } else {
    // No range given at all — make it explicit this is everything,
    // not just an unlabeled/ambiguous export.
    dateSegment = "AllTime";
  }
  parts.push(dateSegment);

  const generatedAt = new Date().toISOString().split("T")[0];
  parts.push(`Generated-${generatedAt}`);

  return `${parts.join("-")}.xlsx`;
}