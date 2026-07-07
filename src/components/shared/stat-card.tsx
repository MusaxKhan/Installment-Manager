import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  className?: string;
  variant?: "blue" | "indigo" | "amber" | "emerald" | "rose" | "violet" | "cyan" | "slate";
  /** When set, the whole card becomes a link — used so dashboard stat
   * cards can take the person straight to the page that explains the
   * number (e.g. "Ongoing Contracts" -> /contracts?status=ACTIVE). */
  href?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  className,
  variant = "slate",
  href,
}: StatCardProps) {
  
  const variantStyles = {
    slate: {
      bg: "bg-card border-border hover:border-muted-foreground/30",
      text: "text-foreground font-black",
      iconBg: "bg-muted text-muted-foreground",
    },
    blue: {
      bg: "bg-card border-sky-500/15 hover:border-sky-500/35 dark:border-sky-400/20 dark:hover:border-sky-400/40",
      text: "text-sky-600 font-black dark:text-sky-400",
      iconBg: "bg-sky-500/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-400",
    },
    indigo: {
      bg: "bg-card border-indigo-500/15 hover:border-indigo-500/35 dark:border-indigo-400/20 dark:hover:border-indigo-400/40",
      text: "text-indigo-600 font-black dark:text-indigo-400",
      iconBg: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400",
    },
    amber: {
      bg: "bg-card border-amber-500/15 hover:border-amber-500/35 dark:border-amber-400/20 dark:hover:border-amber-400/40",
      text: "text-amber-600 font-black dark:text-amber-400",
      iconBg: "bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400",
    },
    emerald: {
      bg: "bg-card border-emerald-500/15 hover:border-emerald-500/35 dark:border-emerald-400/20 dark:hover:border-emerald-400/40",
      text: "text-emerald-600 font-black dark:text-emerald-400",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400",
    },
    rose: {
      bg: "bg-card border-rose-500/15 hover:border-rose-500/35 dark:border-rose-400/20 dark:hover:border-rose-400/40",
      text: "text-rose-600 font-black dark:text-rose-400",
      iconBg: "bg-rose-500/10 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400",
    },
    violet: {
      bg: "bg-card border-violet-500/15 hover:border-violet-500/35 dark:border-violet-400/20 dark:hover:border-violet-400/40",
      text: "text-violet-600 font-black dark:text-violet-400",
      iconBg: "bg-violet-500/10 text-violet-600 dark:bg-violet-400/10 dark:text-violet-400",
    },
    cyan: {
      bg: "bg-card border-cyan-500/15 hover:border-cyan-500/35 dark:border-cyan-400/20 dark:hover:border-cyan-400/40",
      text: "text-cyan-600 font-black dark:text-cyan-400",
      iconBg: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-400",
    },
  };

  const currentStyles = variantStyles[variant];

  const cardContent = (
    <CardContent className="flex items-start justify-between gap-4 p-5">
      <div className="space-y-1">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground transition-colors">
          {label}
        </p>
        <p className={cn("text-2xl tabular-nums tracking-tight leading-none pt-1", currentStyles.text)}>
          {value}
        </p>
        {hint && (
          <p className="text-[11px] font-medium text-muted-foreground mt-1.5 flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
            {hint}
          </p>
        )}
      </div>
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 shadow-sm border border-black/[0.02] dark:border-white/[0.03]", currentStyles.iconBg)}>
        {href ? (
          <ChevronRight className="h-4 w-4 stroke-[2.5] opacity-0 group-hover:opacity-100 transition-opacity absolute" />
        ) : null}
        <Icon className={cn("h-4 w-4 stroke-[2.5] transition-opacity", href && "group-hover:opacity-0")} />
      </div>
    </CardContent>
  );

  const cardClassName = cn(
    "group relative overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
    href && "cursor-pointer",
    currentStyles.bg,
    className
  );

  if (href) {
    return (
      <Link href={href} className="block">
        <Card className={cardClassName}>{cardContent}</Card>
      </Link>
    );
  }

  return <Card className={cardClassName}>{cardContent}</Card>;
}