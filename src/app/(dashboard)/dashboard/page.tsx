import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  Users,
  Landmark,
  TrendingUp,
  Wallet,
  Coins,
  AlertCircle,
  ArrowRight,
  TrendingDown,
  Sparkles
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { ContractStatusBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardStats } from "@/lib/services/dashboard-service";
import { listContracts } from "@/lib/services/contract-service";
import { getActiveBusinessPhase } from "@/lib/services/business-phase-service";
import { formatPKR, formatDate } from "@/lib/utils/format";
import { Download } from "lucide-react";
import { ExportDialog } from "@/components/export/export-dialog";
import { listBusinessPhases } from "@/lib/services/business-phase-service";

export default async function DashboardPage() {
  const [
    stats,
    overdueContracts,
    activePhase,
    phases,
  ] = await Promise.all([
    getDashboardStats(),
    listContracts({ status: "OVERDUE" }),
    getActiveBusinessPhase(),
    listBusinessPhases(),
  ]);

  // Quick mathematical metrics for modern UI highlights
  const totalProfits = stats.totalProfitGenerated || 1;
  const payoutRatio = Math.min(Math.round(((stats.totalProfitDistributed || 0) / totalProfits) * 100), 100);

  return (
    <div className="space-y-8 p-2 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      {/* 1. Header Section with Quick Stats Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Dashboard</h1>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse mt-1" />
          </div>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            Sitara Traders operational insights and capital distribution framework.
          </p>
        </div>
        
        {/* Dynamic Context Tag */}
        <div className="flex items-center gap-3 self-start md:self-center">
        {/* Export Button */}
        <ExportDialog phases={phases} />

        {/* Active Phase Badge */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 rounded-xl p-1.5 pr-3">
          <div className="bg-white text-slate-700 p-1.5 rounded-lg shadow-sm text-xs font-bold flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            Active Phase:
          </div>

          <span className="text-xs font-black text-slate-800">
            {activePhase ? activePhase.phaseName : "None Configured"}
          </span>
        </div>
      </div>
      </div>

      {/* Warning Notification Banner */}
      {!activePhase && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50/60 to-transparent shadow-sm rounded-2xl overflow-hidden relative">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-amber-500" />
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shadow-sm">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900">System Capital Flow Halt</p>
              <p className="text-xs font-medium text-amber-700/90 mt-0.5 leading-relaxed">
                No active business phase discovered. Closed contracts cannot issue dynamic payouts to investors until an operation window is initiated.
              </p>
            </div>
            <Button size="sm" className="bg-amber-600 text-white hover:bg-amber-700 shadow-sm rounded-xl font-bold self-start sm:self-center" asChild>
              <Link href="/phases/new">Initialize New Phase</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 2. Primary 2-Column Split Master Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* LEFT TWO-THIRDS: Core Operational Metrics & Focus Lists */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Subheading Group: Core Operations */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">Core Operational Metrics</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard label="Active Portfolio Contracts" value={String(stats.totalActiveContracts)} icon={FileText} variant="blue" />
              <StatCard label="Total Registered Clients" value={String(stats.totalClients)} icon={Users} variant="cyan" />
              <StatCard label="Outstanding Amount" value={formatPKR(stats.totalOutstandingAmount)} icon={Wallet} hint="Across active & overdue items" variant="indigo" />
              <StatCard label="Critical Overdue Contracts" value={String(stats.totalOverdueContracts)} icon={AlertTriangle} variant="rose" />
            </div>
          </div>

          {/* Overdue List Block with detailed presentation items */}
          <Card className="border-slate-200/70 shadow-sm bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-5 border-b border-slate-100">
              <div>
                <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                  Action Required
                  {overdueContracts.length > 0 && (
                    <span className="inline-flex items-center rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 ring-1 ring-inset ring-rose-600/10">
                      {overdueContracts.length} Overdue
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs font-medium text-slate-400 mt-0.5">
                  Collection queues sorted by descending time deltas.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl group" asChild>
                <Link href="/contracts?status=OVERDUE" className="flex items-center gap-1">
                  View Overdue Contracts
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </CardHeader>
            
            <CardContent className="p-0">
              {overdueContracts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-sm font-bold text-slate-800">Portfolio fully functional</p>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">No overdue contracts.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {overdueContracts.slice(0, 4).map((contract) => (
                    <Link
                      key={contract.id}
                      href={`/contracts/${contract.id}`}
                      className="flex items-center justify-between gap-4 px-6 py-4 transition-all hover:bg-slate-50/60 group"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                          {contract.client.name}
                          <span className="text-xs font-bold text-slate-400 ml-2 bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 rounded">
                            {contract.contractCode}
                          </span>
                        </p>
                        <div className="text-xs font-bold text-slate-400 flex items-center gap-2 flex-wrap">
                          <span className="text-slate-600 font-extrabold">{contract.productName}</span>
                          <span>•</span>
                          <span className="text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded font-black">
                            {contract.overdueMonths}m overdue
                          </span>
                          <span>•</span>
                          <span className="font-medium text-slate-400">Started {formatDate(contract.startDate)}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-black tabular-nums text-rose-600">
                          {formatPKR(contract.remainingBalance)}
                        </span>
                        <div className="shadow-sm rounded-md overflow-hidden">
                          <ContractStatusBadge status={contract.status} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT ONE-THIRD: Capital Infrastructure Sidebar Panel */}
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">Capital Distribution</h3>
            <div className="space-y-4">
              <StatCard label="Total Capital Investors" value={String(stats.totalInvestors)} icon={Landmark} variant="violet" />
              <StatCard label="Active Investment" value={formatPKR(stats.activePhaseInvestmentTotal)} icon={Landmark} hint={activePhase ? activePhase.phaseName : "No active cycle"} variant="slate" />
            </div>
          </div>

          {/* Performance Yield Analysis Panel */}
          <Card className="border-slate-200/80 shadow-sm bg-gradient-to-b from-white via-slate-50/30 to-slate-50/70 rounded-2xl overflow-hidden relative">
            <CardHeader className="pb-4 border-b border-slate-100 bg-white">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-400">Yield Analytics</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              {/* Yield Stat Item 1 */}
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-slate-400">Gross Profits Generated</p>
                  <p className="text-xl font-black text-emerald-600 mt-1">{formatPKR(stats.totalProfitGenerated)}</p>
                </div>
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 stroke-[2.5]" />
                </div>
              </div>

              {/* Yield Stat Item 2 */}
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-slate-400">Profit Distributed</p>
                  <p className="text-xl font-black text-amber-600 mt-1">{formatPKR(stats.totalProfitDistributed)}</p>
                </div>
                <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Coins className="h-4 w-4 stroke-[2.5]" />
                </div>
              </div>

              {/* Functional Dynamic Progress Component */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">Profit Shared with Investors</span>
                  <span className="text-slate-800">{payoutRatio}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${payoutRatio}%` }}
                  />
                </div>
                <p className="text-[11px] font-medium text-slate-400 leading-normal">
                  Proportion of completed contract returns dispersed back to capitalization channels.
                </p>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}