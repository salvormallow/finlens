// ─── Cash Flow Forecasting Engine ────────────────────────────────

export interface ForecastInput {
  id: string;
  dataType: "income" | "expense";
  amount: number;
  date: string;
}

export interface ForecastPoint {
  date: string;
  projected: number;
  high: number;
  low: number;
}

export interface LowBalanceWarning {
  date: string;
  projected: number;
}

export interface ForecastResult {
  points: ForecastPoint[];
  startBalance: number;
  endBalance: number;
  totalExpectedIncome: number;
  totalExpectedExpenses: number;
  lowBalanceWarnings: LowBalanceWarning[];
}

// Group amounts by day-of-month (1-31) for pattern detection
function buildDayOfMonthPattern(
  rows: ForecastInput[],
  type: "income" | "expense",
  monthCount: number
): Map<number, number> {
  const dayTotals = new Map<number, number>();
  for (const r of rows) {
    if (r.dataType !== type) continue;
    const day = new Date(r.date).getDate();
    dayTotals.set(day, (dayTotals.get(day) || 0) + r.amount);
  }
  // Average per month
  const pattern = new Map<number, number>();
  for (const [day, total] of dayTotals) {
    pattern.set(day, total / monthCount);
  }
  return pattern;
}

// Compute monthly variance for confidence bands
function computeMonthlyVariance(
  rows: ForecastInput[],
  type: "income" | "expense"
): number {
  // Group by year-month
  const monthTotals = new Map<string, number>();
  for (const r of rows) {
    if (r.dataType !== type) continue;
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthTotals.set(key, (monthTotals.get(key) || 0) + r.amount);
  }

  const values = Array.from(monthTotals.values());
  if (values.length < 2) return 0;

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function generateForecast(
  rows: ForecastInput[],
  currentBalance: number,
  horizonDays: number
): ForecastResult {
  // Determine how many months of history we have
  const dates = rows.map((r) => new Date(r.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const monthCount = Math.max(
    1,
    Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24 * 30))
  );

  // Build day-of-month patterns
  const incomePattern = buildDayOfMonthPattern(rows, "income", monthCount);
  const expensePattern = buildDayOfMonthPattern(rows, "expense", monthCount);

  // Compute variance for confidence bands
  const incomeVariance = computeMonthlyVariance(rows, "income");
  const expenseVariance = computeMonthlyVariance(rows, "expense");
  const monthlyVariance = incomeVariance + expenseVariance;
  // Daily standard deviation (rough)
  const dailyStddev = monthlyVariance / Math.sqrt(30);

  const points: ForecastPoint[] = [];
  const warnings: LowBalanceWarning[] = [];

  let balance = currentBalance;
  let totalIncome = 0;
  let totalExpenses = 0;

  const today = new Date();

  for (let d = 1; d <= horizonDays; d++) {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + d);
    const dom = futureDate.getDate();

    const dayIncome = incomePattern.get(dom) || 0;
    const dayExpense = expensePattern.get(dom) || 0;

    balance += dayIncome - dayExpense;
    totalIncome += dayIncome;
    totalExpenses += dayExpense;

    // Confidence band grows with sqrt of time
    const cumStddev = dailyStddev * Math.sqrt(d);

    const point: ForecastPoint = {
      date: futureDate.toISOString().split("T")[0],
      projected: Math.round(balance),
      high: Math.round(balance + cumStddev),
      low: Math.round(balance - cumStddev),
    };
    points.push(point);

    // Low balance warning
    if (point.low < 500) {
      warnings.push({ date: point.date, projected: point.projected });
    }
  }

  return {
    points,
    startBalance: Math.round(currentBalance),
    endBalance: Math.round(balance),
    totalExpectedIncome: Math.round(totalIncome),
    totalExpectedExpenses: Math.round(totalExpenses),
    lowBalanceWarnings: warnings.slice(0, 5), // limit to 5
  };
}
