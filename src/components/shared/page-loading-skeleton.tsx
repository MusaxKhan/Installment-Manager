import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Generic loading skeleton used as the default loading.tsx for most
 * server-rendered dashboard routes. Approximates "a header, then a
 * card containing a table" since that's the shape of the large
 * majority of pages in this app (clients, contracts, investors,
 * payments, withdrawals, distributions, loans, etc.) — one shared
 * skeleton beats a dozen bespoke ones for not much visual cost, and
 * it's a lot easier to keep consistent.
 */
export function PageLoadingSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-border px-3 py-3">
            <div className="flex gap-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-20" />
              ))}
            </div>
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 px-3 py-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** A lighter variant for detail/form pages — a back button, a title, one card. */
export function DetailPageLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Skeleton className="h-8 w-36" />
      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-1/3" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}