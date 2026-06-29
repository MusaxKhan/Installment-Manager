import { Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function BlacklistBadge({ maxOverdueMonths }: { maxOverdueMonths?: number }) {
  return (
    <Badge variant="overdue" className="flex w-fit items-center gap-1">
      <Ban className="h-3 w-3" />
      Blacklisted
      {maxOverdueMonths !== undefined && maxOverdueMonths > 0
        ? ` · ${maxOverdueMonths}mo overdue`
        : ""}
    </Badge>
  );
}