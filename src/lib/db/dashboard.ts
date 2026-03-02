import { sql } from "@/lib/db";
import { decryptNumber } from "./encryption";
import type {
  DataType,
  Priority,
  FinancialSummary,
  NetWorthTrend,
  MonthlyPnL,
  PortfolioAllocation,
  CashFlowItem,
  TaxOverview,
  DashboardRecommendation,
  DashboardData,
} from "@/types/financial";

// ─── Raw DB row shapes (encrypted amounts) ─────────────────────

interface RawFinancialRow {
  data_type: string;
  category: string;
  amount: string; // encrypted
  date: string;
}

interface RawHoldingRow {
  symbol: string;
  asset_class: string | null;
  quantity: number;
  cost_basis: string; // encrypted
  current_value: string; // encrypted
}

// ─── Decrypted in-memory shapes ─────────────────────────────────

interface DecryptedRow {
  dataType: DataType;
  category: string;
  amount: number;
  date: Date;
  yearMonth: string; // "YYYY-MM"
}

interface DecryptedHolding {
  symbol: string;
  assetClass: string;
  quantity: number;
  costBasis: number;
  currentValue: number;
}

// ─── Helpers ────────────────────────────────────────────────────

function toYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatMonthShort(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString("en-US", { month: "short" });
}

const EMPTY_SUMMARY: FinancialSummary = {
  netWorth: 0,
  totalAssets: 0,
  totalLiabilities: 0,
  monthlyIncome: 0,
  monthlyExpenses: 0,
  savingsRate: 0,
  lastUpdated: null,
};

const EMPTY_TAX: TaxOverview = {
  estimatedLiability: 0,
  withholdingsYtd: 0,
  estimatedBalanceDue: 0,
  hasData: false,
};

// ─── Main export ────────────────────────────────────────────────

export async function getDashboardData(userId: string): Promise<DashboardData> {
  // 1. Fetch all data in parallel
  const [financialResult, holdingsResult] = await Promise.all([
    sql`SELECT data_type, category, amount, date
        FROM financial_data WHERE user_id = ${userId}`,
    sql`SELECT symbol, asset_class, quantity, cost_basis, current_value
        FROM portfolio_holdings WHERE user_id = ${userId}`,
  ]);

  // 2. Decrypt (skip rows that fail decryption — e.g. key mismatch from dev/prod)
  const rows: DecryptedRow[] = [];
  for (const r of financialResult.rows) {
    try {
      const raw = r as unknown as RawFinancialRow;
      const d = new Date(raw.date);
      rows.push({
        dataType: raw.data_type as DataType,
        category: raw.category,
        amount: decryptNumber(raw.amount),
        date: d,
        yearMonth: toYearMonth(d),
      });
    } catch {
      // Skip rows that can't be decrypted (e.g. key mismatch)
    }
  }

  const holdings: DecryptedHolding[] = [];
  for (const r of holdingsResult.rows) {
    try {
      const raw = r as unknown as RawHoldingRow;
      holdings.push({
        symbol: raw.symbol,
        assetClass: raw.asset_class || "Other",
        quantity: typeof raw.quantity === "string" ? parseFloat(raw.quantity as string) : raw.quantity,
        costBasis: decryptNumber(raw.cost_basis),
        currentValue: decryptNumber(raw.current_value),
      });
    } catch {
      // Skip rows that can't be decrypted
    }
  }

  // 3. Check empty
  if (rows.length === 0 && holdings.length === 0) {
    return {
      hasData: false,
      summary: EMPTY_SUMMARY,
      summaryPriorMonth: null,
      netWorthTrend: [],
      monthlyPnL: [],
      portfolioAllocation: [],
      cashFlow: [],
      taxOverview: EMPTY_TAX,
      recommendations: [],
    };
  }

  // 4. Compute aggregations
  const now = new Date();
  const currentYM = toYearMonth(now);
  const priorDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const priorYM = toYearMonth(priorDate);
  const currentYear = now.getFullYear();

  const summary = computeSummary(rows, holdings, currentYM);
  const summaryPriorMonth = computeMonthSummary(rows, holdings, priorYM);
  const netWorthTrend = computeNetWorthTrend(rows, holdings);
  const monthlyPnL = computeMonthlyPnL(rows);
  const portfolioAllocation = computePortfolioAllocation(holdings);
  const cashFlow = computeCashFlow(rows);
  const taxOverview = computeTaxOverview(rows, currentYear);
  const recommendations = computeRecommendations(summary, rows, holdings);

  return {
    hasData: true,
    summary,
    summaryPriorMonth,
    netWorthTrend,
    monthlyPnL,
    portfolioAllocation,
    cashFlow,
    taxOverview,
    recommendations,
  };
}

// ─── Aggregation functions ──────────────────────────────────────

function computeSummary(
  rows: DecryptedRow[],
  holdings: DecryptedHolding[],
  targetYM: string
): FinancialSummary {
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let totalAssets = 0;
  let totalLiabilities = 0;
  let lastUpdated: Date | null = null;

  // Get latest asset/liability per category (point-in-time snapshots)
  const latestAssets = new Map<string, number>();
  const latestLiabilities = new Map<string, number>();

  for (const r of rows) {
    if (!lastUpdated || r.date > lastUpdated) lastUpdated = r.date;

    if (r.yearMonth === targetYM) {
      if (r.dataType === "income") monthlyIncome += r.amount;
      else if (r.dataType === "expense") monthlyExpenses += r.amount;
    }

    if (r.dataType === "asset") {
      const existing = latestAssets.get(r.category);
      if (existing === undefined || r.amount > 0) {
        latestAssets.set(r.category, r.amount);
      }
    } else if (r.dataType === "liability") {
      const existing = latestLiabilities.get(r.category);
      if (existing === undefined || r.amount > 0) {
        latestLiabilities.set(r.category, r.amount);
      }
    }
  }

  for (const v of latestAssets.values()) totalAssets += v;
  for (const v of latestLiabilities.values()) totalLiabilities += v;

  // Add portfolio holdings to assets
  for (const h of holdings) totalAssets += h.currentValue;

  const netWorth = totalAssets - totalLiabilities;
  const savingsRate =
    monthlyIncome > 0
      ? Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 1000) / 10
      : 0;

  return {
    netWorth,
    totalAssets,
    totalLiabilities,
    monthlyIncome,
    monthlyExpenses,
    savingsRate,
    lastUpdated,
  };
}

function computeMonthSummary(
  rows: DecryptedRow[],
  holdings: DecryptedHolding[],
  targetYM: string
): { netWorth: number; monthlyIncome: number; monthlyExpenses: number } | null {
  const hasTargetData = rows.some((r) => r.yearMonth === targetYM);
  if (!hasTargetData) return null;

  const s = computeSummary(rows, holdings, targetYM);
  return {
    netWorth: s.netWorth,
    monthlyIncome: s.monthlyIncome,
    monthlyExpenses: s.monthlyExpenses,
  };
}

function computeNetWorthTrend(
  rows: DecryptedRow[],
  holdings: DecryptedHolding[]
): NetWorthTrend[] {
  // Group asset/liability amounts by month, taking latest per category per month
  const monthAssets = new Map<string, Map<string, number>>(); // yearMonth -> (category -> amount)
  const monthLiabilities = new Map<string, Map<string, number>>();

  for (const r of rows) {
    if (r.dataType === "asset") {
      if (!monthAssets.has(r.yearMonth)) monthAssets.set(r.yearMonth, new Map());
      monthAssets.get(r.yearMonth)!.set(r.category, r.amount);
    } else if (r.dataType === "liability") {
      if (!monthLiabilities.has(r.yearMonth)) monthLiabilities.set(r.yearMonth, new Map());
      monthLiabilities.get(r.yearMonth)!.set(r.category, r.amount);
    }
  }

  // Also include income-expense net for months without asset snapshots
  const monthIncome = new Map<string, number>();
  const monthExpense = new Map<string, number>();
  for (const r of rows) {
    if (r.dataType === "income") {
      monthIncome.set(r.yearMonth, (monthIncome.get(r.yearMonth) || 0) + r.amount);
    } else if (r.dataType === "expense") {
      monthExpense.set(r.yearMonth, (monthExpense.get(r.yearMonth) || 0) + r.amount);
    }
  }

  // Collect all months
  const allMonths = new Set<string>();
  for (const r of rows) allMonths.add(r.yearMonth);

  const sortedMonths = Array.from(allMonths).sort().slice(-12);
  if (sortedMonths.length === 0) return [];

  const holdingsTotal = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  const trend: NetWorthTrend[] = [];
  for (const ym of sortedMonths) {
    let assets = 0;
    let liabilities = 0;

    const assetMap = monthAssets.get(ym);
    if (assetMap) {
      for (const v of assetMap.values()) assets += v;
    }

    const liabMap = monthLiabilities.get(ym);
    if (liabMap) {
      for (const v of liabMap.values()) liabilities += v;
    }

    // Add holdings to the latest month only
    if (ym === sortedMonths[sortedMonths.length - 1]) {
      assets += holdingsTotal;
    }

    // If no asset/liability data but we have income/expense, estimate from cash flow
    if (assets === 0 && liabilities === 0) {
      const inc = monthIncome.get(ym) || 0;
      const exp = monthExpense.get(ym) || 0;
      assets = inc;
      liabilities = exp;
    }

    trend.push({
      date: formatMonth(ym),
      assets,
      liabilities,
      netWorth: assets - liabilities,
    });
  }

  return trend;
}

function computeMonthlyPnL(rows: DecryptedRow[]): MonthlyPnL[] {
  const monthData = new Map<string, { income: number; expenses: number }>();

  for (const r of rows) {
    if (r.dataType !== "income" && r.dataType !== "expense") continue;

    if (!monthData.has(r.yearMonth)) {
      monthData.set(r.yearMonth, { income: 0, expenses: 0 });
    }
    const entry = monthData.get(r.yearMonth)!;
    if (r.dataType === "income") entry.income += r.amount;
    else entry.expenses += r.amount;
  }

  const sortedMonths = Array.from(monthData.keys()).sort().slice(-6);

  return sortedMonths.map((ym) => {
    const d = monthData.get(ym)!;
    return {
      month: formatMonthShort(ym),
      income: Math.round(d.income),
      expenses: Math.round(d.expenses),
      net: Math.round(d.income - d.expenses),
    };
  });
}

function computePortfolioAllocation(holdings: DecryptedHolding[]): PortfolioAllocation[] {
  if (holdings.length === 0) return [];

  const classValues = new Map<string, number>();
  let total = 0;

  for (const h of holdings) {
    const cls = h.assetClass || "Other";
    classValues.set(cls, (classValues.get(cls) || 0) + h.currentValue);
    total += h.currentValue;
  }

  if (total === 0) return [];

  const allocations: PortfolioAllocation[] = [];
  let otherValue = 0;

  for (const [assetClass, value] of classValues) {
    const percentage = Math.round((value / total) * 1000) / 10;
    if (percentage < 3) {
      otherValue += value;
    } else {
      allocations.push({ assetClass, value: Math.round(value), percentage });
    }
  }

  if (otherValue > 0) {
    allocations.push({
      assetClass: "Other",
      value: Math.round(otherValue),
      percentage: Math.round((otherValue / total) * 1000) / 10,
    });
  }

  return allocations.sort((a, b) => b.value - a.value);
}

function computeCashFlow(rows: DecryptedRow[]): CashFlowItem[] {
  // Find the most recent month with income or expense data
  const months = new Set<string>();
  for (const r of rows) {
    if (r.dataType === "income" || r.dataType === "expense") {
      months.add(r.yearMonth);
    }
  }
  if (months.size === 0) return [];

  const latestMonth = Array.from(months).sort().pop()!;

  const incomeByCategory = new Map<string, number>();
  const expenseByCategory = new Map<string, number>();

  for (const r of rows) {
    if (r.yearMonth !== latestMonth) continue;
    if (r.dataType === "income") {
      incomeByCategory.set(r.category, (incomeByCategory.get(r.category) || 0) + r.amount);
    } else if (r.dataType === "expense") {
      expenseByCategory.set(r.category, (expenseByCategory.get(r.category) || 0) + r.amount);
    }
  }

  const items: CashFlowItem[] = [];

  // Income categories (positive)
  const incomeEntries = Array.from(incomeByCategory.entries())
    .sort((a, b) => b[1] - a[1]);
  for (const [name, value] of incomeEntries) {
    items.push({ name, value: Math.round(value) });
  }

  // Expense categories (negative)
  const expenseEntries = Array.from(expenseByCategory.entries())
    .sort((a, b) => b[1] - a[1]);
  for (const [name, value] of expenseEntries) {
    items.push({ name, value: -Math.round(value) });
  }

  // Net
  const totalIncome = Array.from(incomeByCategory.values()).reduce((s, v) => s + v, 0);
  const totalExpense = Array.from(expenseByCategory.values()).reduce((s, v) => s + v, 0);
  items.push({ name: "Net", value: Math.round(totalIncome - totalExpense) });

  return items;
}

function computeTaxOverview(rows: DecryptedRow[], currentYear: number): TaxOverview {
  const taxRows = rows.filter(
    (r) => r.dataType === "tax" && r.date.getFullYear() === currentYear
  );

  if (taxRows.length === 0) return EMPTY_TAX;

  const withholdingsYtd = taxRows.reduce((sum, r) => sum + r.amount, 0);

  // Estimate liability from income in the same year
  const yearIncome = rows
    .filter((r) => r.dataType === "income" && r.date.getFullYear() === currentYear)
    .reduce((sum, r) => sum + r.amount, 0);

  // Simple effective rate estimate (~22% for typical income levels)
  const effectiveRate = yearIncome > 100000 ? 0.25 : yearIncome > 50000 ? 0.22 : 0.15;
  const estimatedLiability = Math.round(yearIncome * effectiveRate);
  const estimatedBalanceDue = estimatedLiability - Math.round(withholdingsYtd);

  return {
    estimatedLiability,
    withholdingsYtd: Math.round(withholdingsYtd),
    estimatedBalanceDue,
    hasData: true,
  };
}

function computeRecommendations(
  summary: FinancialSummary,
  rows: DecryptedRow[],
  holdings: DecryptedHolding[]
): DashboardRecommendation[] {
  const recs: DashboardRecommendation[] = [];

  // High debt ratio
  if (summary.totalLiabilities > summary.totalAssets * 0.5 && summary.totalAssets > 0) {
    recs.push({
      priority: "high" as Priority,
      text: "Debt-to-asset ratio is high — consider a debt reduction strategy",
    });
  }

  // Low savings rate
  if (summary.monthlyIncome > 0 && summary.savingsRate < 20) {
    recs.push({
      priority: "high" as Priority,
      text: `Savings rate is ${summary.savingsRate.toFixed(0)}% — aim for at least 20%`,
    });
  }

  // Concentrated portfolio
  if (holdings.length > 0) {
    const classValues = new Map<string, number>();
    let total = 0;
    for (const h of holdings) {
      const cls = h.assetClass || "Other";
      classValues.set(cls, (classValues.get(cls) || 0) + h.currentValue);
      total += h.currentValue;
    }
    for (const [cls, val] of classValues) {
      if (total > 0 && val / total > 0.5) {
        recs.push({
          priority: "medium" as Priority,
          text: `Portfolio is over 50% concentrated in ${cls} — consider diversifying`,
        });
        break;
      }
    }
  }

  // Large expense category
  if (summary.monthlyExpenses > 0) {
    const expenseByCategory = new Map<string, number>();
    const now = new Date();
    const currentYM = toYearMonth(now);
    for (const r of rows) {
      if (r.dataType === "expense" && r.yearMonth === currentYM) {
        expenseByCategory.set(r.category, (expenseByCategory.get(r.category) || 0) + r.amount);
      }
    }
    for (const [cat, val] of expenseByCategory) {
      if (val / summary.monthlyExpenses > 0.4) {
        recs.push({
          priority: "medium" as Priority,
          text: `${cat} makes up over 40% of monthly expenses — review for savings`,
        });
        break;
      }
    }
  }

  // Missing tax data
  const hasTaxData = rows.some((r) => r.dataType === "tax");
  if (!hasTaxData) {
    recs.push({
      priority: "low" as Priority,
      text: "Upload W-2 or 1099 documents for tax analysis",
    });
  }

  // Sort by priority and limit to 3
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recs.slice(0, 3);
}
