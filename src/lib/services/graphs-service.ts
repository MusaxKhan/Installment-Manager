import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { round2 } from "@/lib/utils/calculations";
import {
  BUSINESS_EXPENSE_CATEGORY_LABELS,
  type BusinessExpenseCategory,
} from "@/types/domain";

export class GraphsServiceError extends Error {}

export interface CashFlowPoint {
  /** YYYY-MM */
  month: string;
  label: string;
  cashIn: number;
  cashOut: number;
  netChange: number;
  runningBalance: number;
}

export interface ContractStatusSlice {
  status: string;
  count: number;
}

export interface MonthlyCollectionPoint {
  month: string;
  label: string;
  amountCollected: number;
}

export interface ProfitComparisonPoint {
  label: string;
  generated: number;
  distributed: number;
}

export interface InvestorCapitalSlice {
  investorName: string;
  amount: number;
}

export interface ExpenseCategorySlice {
  label: string;
  amount: number;
}

export interface GraphsData {
  cashFlow: CashFlowPoint[];
  contractStatus: ContractStatusSlice[];
  monthlyCollections: MonthlyCollectionPoint[];
  profitComparison: ProfitComparisonPoint[];
  investorCapital: InvestorCapitalSlice[];
  cashInHandVsLoans: { label: string; value: number }[];
  expenseBreakdown: ExpenseCategorySlice[];
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/** Builds the last N month keys ending at the current month, oldest first */
function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export async function getGraphsData(): Promise<GraphsData> {
  const supabase = await createClient();

  let ledgerData: { entry_date: string; amount: number }[];
  let contractsData: { status: string }[];
  let paymentsData: { payment_date: string; amount_paid: number }[];
  let completedContractsData: { profit_amount: number }[];
  let distributionsData: { profit_amount: number; investor: { name: string } | null }[];
  let loansData: { amount: number; amount_repaid: number }[];
  let activePhaseRes: { data: { id: number } | null; error: { message: string } | null };
  let businessExpensesData: { category: BusinessExpenseCategory; amount: number }[];
  let contractPurchaseTotalData: { purchase_price: number }[];

  try {
    // All six of these grow without bound over the business's lifetime
    // (every ledger entry, every payment, every contract, forever) — a
    // bare .select() here is silently capped at whatever the Supabase
    // project's max_rows is set to, which would quietly understate
    // every chart on this page once any of these tables crosses that
    // row count. fetchAllRows pages through everything instead.
    [
      ledgerData,
      contractsData,
      paymentsData,
      completedContractsData,
      distributionsData,
      activePhaseRes,
      loansData,
      businessExpensesData,
      contractPurchaseTotalData,
    ] = await Promise.all([
      fetchAllRows((from, to) =>
        supabase
          .from("cash_ledger")
          .select("entry_date, amount")
          .order("entry_date", { ascending: true })
          .range(from, to)
      ),
      fetchAllRows((from, to) =>
        supabase.from("contracts").select("status").range(from, to)
      ),
      fetchAllRows((from, to) =>
        supabase.from("payments").select("payment_date, amount_paid").range(from, to)
      ),
      fetchAllRows((from, to) =>
        supabase
          .from("contracts")
          .select("profit_amount")
          .eq("status", "COMPLETED")
          .range(from, to)
      ),
      fetchAllRows((from, to) =>
        supabase
          .from("profit_distributions")
          .select("profit_amount, investor:investors(name)")
          .range(from, to)
      ),
      supabase
        .from("business_phases")
        .select("id")
        .eq("status", "ACTIVE")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      fetchAllRows((from, to) =>
        supabase.from("loans").select("amount, amount_repaid").range(from, to)
      ),
      fetchAllRows((from, to) =>
        supabase.from("business_expenses").select("category, amount").range(from, to)
      ),
      fetchAllRows((from, to) =>
        supabase.from("contracts").select("purchase_price").range(from, to)
      ),
    ]);
  } catch (err) {
    throw new GraphsServiceError(
      `Failed to load graph data: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }

  if (activePhaseRes.error) {
    throw new GraphsServiceError(
      `Failed to load graph data: ${activePhaseRes.error.message}`
    );
  }

  // ── Cash flow over the last 12 months ──
  const months = lastNMonthKeys(12);
  const cashInByMonth = new Map<string, number>();
  const cashOutByMonth = new Map<string, number>();
  let balanceBeforeWindow = 0;

  for (const row of ledgerData) {
    const key = monthKey(row.entry_date);
    const amount = Number(row.amount);
    if (months.includes(key)) {
      if (amount >= 0) {
        cashInByMonth.set(key, round2((cashInByMonth.get(key) ?? 0) + amount));
      } else {
        cashOutByMonth.set(
          key,
          round2((cashOutByMonth.get(key) ?? 0) + Math.abs(amount))
        );
      }
    } else if (key < months[0]) {
      balanceBeforeWindow = round2(balanceBeforeWindow + amount);
    }
  }

  let runningBalance = balanceBeforeWindow;
  const cashFlow: CashFlowPoint[] = months.map((m) => {
    const cashIn = cashInByMonth.get(m) ?? 0;
    const cashOut = cashOutByMonth.get(m) ?? 0;
    const netChange = round2(cashIn - cashOut);
    runningBalance = round2(runningBalance + netChange);
    return {
      month: m,
      label: monthLabel(m),
      cashIn,
      cashOut,
      netChange,
      runningBalance,
    };
  });

  // ── Contract status breakdown ──
  const statusCounts = new Map<string, number>();
  for (const row of contractsData) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  }
  const contractStatus: ContractStatusSlice[] = Array.from(
    statusCounts.entries()
  ).map(([status, count]) => ({ status, count }));

  // ── Monthly payment collections (last 12 months) ──
  const collectionsByMonth = new Map<string, number>();
  for (const row of paymentsData) {
    const key = monthKey(row.payment_date);
    if (months.includes(key)) {
      collectionsByMonth.set(
        key,
        round2((collectionsByMonth.get(key) ?? 0) + Number(row.amount_paid))
      );
    }
  }
  const monthlyCollections: MonthlyCollectionPoint[] = months.map((m) => ({
    month: m,
    label: monthLabel(m),
    amountCollected: collectionsByMonth.get(m) ?? 0,
  }));

  // ── Profit generated vs distributed ──
  const totalGenerated = completedContractsData.reduce(
    (sum, c) => sum + Number(c.profit_amount),
    0
  );
  const totalDistributed = distributionsData.reduce(
    (sum, d) => sum + Number(d.profit_amount),
    0
  );
  const profitComparison: ProfitComparisonPoint[] = [
    {
      label: "Profit",
      generated: round2(totalGenerated),
      distributed: round2(totalDistributed),
    },
  ];

  // ── Investor capital breakdown (active phase only) ──
  let investorCapital: InvestorCapitalSlice[] = [];
  if (activePhaseRes.data?.id) {
    const investments = await fetchAllRows<{
      investment_amount: number;
      investor: { name: string } | null;
    }>((from, to) =>
      supabase
        .from("investor_phase_investments")
        .select("investment_amount, investor:investors(name)")
        .eq("phase_id", activePhaseRes.data!.id)
        .range(from, to)
    ).catch((err) => {
      throw new GraphsServiceError(
        `Failed to load investor capital breakdown: ${err.message}`
      );
    });

    investorCapital = investments.map((row) => ({
      investorName: row.investor?.name ?? "Unknown",
      amount: Number(row.investment_amount),
    }));
  }

  // ── Cash in hand vs outstanding loans ──
  const cashInHandRes = await supabase.rpc("current_cash_in_hand");
  const totalOutstandingLoans = loansData.reduce(
    (sum, l) => sum + Math.max(0, Number(l.amount) - Number(l.amount_repaid)),
    0
  );
  const cashInHandVsLoans = [
    { label: "Cash in Hand", value: Number(cashInHandRes.data ?? 0) },
    { label: "Outstanding Loans", value: round2(totalOutstandingLoans) },
  ];

  // ── Expense breakdown: each business expense category, plus contract
  // purchases as one combined slice ──
  const expenseCategoryTotals = new Map<BusinessExpenseCategory, number>();
  for (const row of businessExpensesData) {
    expenseCategoryTotals.set(
      row.category,
      round2((expenseCategoryTotals.get(row.category) ?? 0) + Number(row.amount))
    );
  }
  const totalContractPurchases = round2(
    contractPurchaseTotalData.reduce(
      (sum, c) => sum + Number(c.purchase_price),
      0
    )
  );
  const expenseBreakdown: ExpenseCategorySlice[] = [
    ...(totalContractPurchases > 0
      ? [{ label: "Contract Purchases", amount: totalContractPurchases }]
      : []),
    ...Array.from(expenseCategoryTotals.entries()).map(([category, amount]) => ({
      label: BUSINESS_EXPENSE_CATEGORY_LABELS[category],
      amount,
    })),
  ];

  return {
    cashFlow,
    contractStatus,
    monthlyCollections,
    profitComparison,
    investorCapital,
    cashInHandVsLoans,
    expenseBreakdown,
  };
}