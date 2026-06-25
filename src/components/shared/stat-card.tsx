import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  className?: string;
  variant?: "blue" | "indigo" | "amber" | "emerald" | "rose" | "violet" | "cyan" | "slate";
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  className,
  variant = "slate",
}: StatCardProps) {
  
  const variantStyles = {
    slate: { bg: "bg-white border-slate-200/80 hover:border-slate-300", text: "text-slate-900 font-black", iconBg: "bg-slate-50 text-slate-600" },
    blue: { bg: "bg-white border-blue-100/80 hover:border-blue-200", text: "text-blue-700 font-black", iconBg: "bg-blue-50/80 text-blue-600" },
    indigo: { bg: "bg-white border-indigo-100/80 hover:border-indigo-200", text: "text-indigo-700 font-black", iconBg: "bg-indigo-50/80 text-indigo-600" },
    amber: { bg: "bg-white border-amber-100/80 hover:border-amber-200", text: "text-amber-700 font-black", iconBg: "bg-amber-50/80 text-amber-600" },
    emerald: { bg: "bg-white border-emerald-100/80 hover:border-emerald-200", text: "text-emerald-700 font-black", iconBg: "bg-emerald-50/80 text-emerald-600" },
    rose: { bg: "bg-white border-rose-100/80 hover:border-rose-200", text: "text-rose-700 font-black", iconBg: "bg-rose-50/80 text-rose-600" },
    violet: { bg: "bg-white border-violet-100/80 hover:border-violet-200", text: "text-violet-700 font-black", iconBg: "bg-violet-50/80 text-violet-600" },
    cyan: { bg: "bg-white border-cyan-100/80 hover:border-cyan-200", text: "text-cyan-700 font-black", iconBg: "bg-cyan-50/80 text-cyan-600" }
  };

  const currentStyles = variantStyles[variant];

  return (
    <Card className={cn("group relative overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md", currentStyles.bg, className)}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 group-hover:text-slate-500 transition-colors">
            {label}
          </p>
          <p className={cn("text-2xl tabular-nums tracking-tight leading-none pt-1", currentStyles.text)}>
            {value}
          </p>
          {hint && (
            <p className="text-[11px] font-medium text-slate-400 mt-1.5 flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              {hint}
            </p>
          )}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 shadow-sm border border-black/[0.02]", currentStyles.iconBg)}>
          <Icon className="h-4 w-4 stroke-[2.5]" />
        </div>
      </CardContent>
    </Card>
  );
}