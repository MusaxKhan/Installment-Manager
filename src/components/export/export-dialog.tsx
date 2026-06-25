"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
} from "lucide-react";

type Phase = {
  id: number;
  phaseName: string;
};

interface ExportDialogProps {
  phases: Phase[];
}

export function ExportDialog({
  phases,
}: ExportDialogProps) {
    
  const [phaseId, setPhaseId] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("all");
  const [reportType, setReportType] = useState("FULL");
  const [isExporting, setIsExporting] = useState(false);
  const [open, setOpen] = useState(false);
  
  const handleExport = async () => {
  try {
    setIsExporting(true);

    const params = new URLSearchParams();

    params.set("reportType", reportType);

    if (phaseId !== "all") {
      params.set("phaseId", phaseId);
    }

    if (fromDate) {
      params.set("from", fromDate);
    }

    if (toDate) {
      params.set("to", toDate);
    }

    if (status !== "all") {
      params.set("status", status);
    }

    const response = await fetch(
      `/api/export/excel?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(
        "Failed to generate export"
      );
    }

    const blob =
      await response.blob();

    const url =
      window.URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    const today =
      new Date()
        .toISOString()
        .split("T")[0];

    a.download =
      `Sitara-Traders-${today}.xlsx`;

    document.body.appendChild(a);

    a.click();

    a.remove();

    window.URL.revokeObjectURL(url);

    setOpen(false);

    setPhaseId("all");
    setStatus("all");
    setFromDate("");
    setToDate("");
    setReportType("FULL");
  } catch (error) {
    console.error(error);

    alert(
      "Failed to generate export"
    );
  } finally {
    setIsExporting(false);
  }
};

  return (
    <Dialog
        open={open}
        onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Export Center
          </DialogTitle>

          <DialogDescription>
            Generate Excel reports for business data.
          </DialogDescription>
        </DialogHeader>

        {isExporting && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
            <div className="bg-background border rounded-xl shadow-lg px-6 py-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <div>
                <p className="font-medium">
                Generating Report
                </p>
                <p className="text-sm text-muted-foreground">
                Please wait...
                </p>
            </div>
            </div>
        </div>
        )}
        <div className="space-y-6 mt-4">
        {/* Report Type */}
            <div>
                <label className="text-sm font-medium">
                Report Type
                </label>

                <select
                value={reportType}
                onChange={(e) =>
                    setReportType(e.target.value)
                }
                className="w-full mt-2 border rounded-md p-2"
                disabled={isExporting}
                >
                <option value="FULL">
                    Full Backup
                </option>

                <option value="COLLECTIONS">
                    Collections Report
                </option>

                <option value="INVESTORS">
                    Investor Report
                </option>

                <option value="PHASE">
                    Phase Report
                </option>
                </select>
            </div>

          <div>
            <label className="text-sm font-medium">
              Business Phase
            </label>

            <select
              value={phaseId}
              onChange={(e) =>
                setPhaseId(e.target.value)
              }
              className="w-full mt-2 border rounded-md p-2"
              disabled={isExporting}
            >
              <option value="all">
                All Phases
              </option>

              {phases.map((phase) => (
                <option
                  key={phase.id}
                  value={phase.id}
                >
                  {phase.phaseName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">

            <div>
              <label className="text-sm font-medium">
                From Date
              </label>

              <input
                type="date"
                value={fromDate}
                onChange={(e) =>
                  setFromDate(e.target.value)
                }
                className="w-full mt-2 border rounded-md p-2"
                disabled={isExporting}
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                To Date
              </label>

              <input
                type="date"
                value={toDate}
                onChange={(e) =>
                  setToDate(e.target.value)
                }
                className="w-full mt-2 border rounded-md p-2"
                disabled={isExporting}
              />
            </div>
            <div>
                <label className="text-sm font-medium">
                    Contract Status
                </label>

                <select
                    value={status}
                    onChange={(e) =>
                    setStatus(e.target.value)
                    }
                    className="w-full mt-2 border rounded-md p-2"
                    disabled={isExporting}
                >
                    <option value="all">
                    All Statuses
                    </option>

                    <option value="ACTIVE">
                    Active
                    </option>

                    <option value="COMPLETED">
                    Completed
                    </option>

                    <option value="OVERDUE">
                    Overdue
                    </option>
                </select>
                </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full"
            >
            {isExporting
                ? "Generating Report..."
                : "Generate Excel Report"}
            </Button>

        </div>
      </DialogContent>
    </Dialog>
  );
}