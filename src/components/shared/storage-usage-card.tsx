import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database } from "lucide-react";
import type { StorageUsage } from "@/lib/services/storage-usage-service";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function StorageUsageCard({ usage }: { usage: StorageUsage | null }) {
  if (!usage) {
    return (
      <Card className="border-border shadow-sm bg-card rounded-2xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-border">
          <CardTitle className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-xs text-muted-foreground">
            Run migration 005 (get_database_size_bytes) in Supabase to enable
            this.
          </p>
        </CardContent>
      </Card>
    );
  }

  const percent = Math.round(usage.percentUsed);
  const barColor =
    percent >= 90
      ? "from-rose-500 to-rose-600 dark:from-rose-400 dark:to-rose-500"
      : percent >= 70
        ? "from-amber-500 to-amber-600 dark:from-amber-400 dark:to-amber-500"
        : "from-emerald-500 to-emerald-600 dark:from-emerald-400 dark:to-emerald-500";
  const textColor =
    percent >= 90
      ? "text-rose-600 dark:text-rose-400"
      : percent >= 70
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400";

  return (
    <Card className="border-border shadow-sm bg-card rounded-2xl overflow-hidden">
      <CardHeader className="pb-4 border-b border-border">
        <CardTitle className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Database className="h-4 w-4" />
          Database Storage
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-2">
        <div className="flex justify-between text-xs font-bold">
          <span className="text-muted-foreground">
            {formatBytes(usage.usedBytes)} of {formatBytes(usage.quotaBytes)} used
          </span>
          <span className={textColor}>{percent}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className={`bg-gradient-to-r ${barColor} h-full rounded-full transition-all duration-500`}
            style={{ width: `${Math.max(percent, 2)}%` }}
          />
        </div>
        <p className="text-[11px] font-medium text-muted-foreground leading-normal">
          {percent >= 90
            ? "Approaching your plan's database limit — consider upgrading or archiving old data."
            : "Total Postgres database size against your Supabase plan's included storage."}
        </p>
      </CardContent>
    </Card>
  );
}