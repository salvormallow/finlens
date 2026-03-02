import { sql } from "@/lib/db";
import { decryptNumber } from "./encryption";
import type {
  DashboardPeriod,
  TransactionRecord,
  SpendingTrendCategory,
  SpendingTrendsResponse,
} from "@/types/financial";

// ─── Helpers ────────────────────────────────────────────────────

function periodStartDate(period: DashboardPeriod): string | null {
  if (period === "all") return null;
  const months: Record<string, number> = { "3m": 3, "6m": 6, "12m": 12 };
  const d = new Date();
  d.setMonth(d.getMonth() - months[period]);
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

function toYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// ─── Raw row shape ──────────────────────────────────────────────

interface RawTransactionRow {
  id: string;
  data_type: string;
  category: string;
  subcategory: string | null;
  amount: string; // encrypted
  date: string;
  description: string | null;
  source: string;
}

// ─── Get paginated, filtered, sorted transactions ───────────────

export async function getTransactions(
  userId: string,
  opts: {
    page: number;
    pageSize: number;
    sort: string;
    order: "asc" | "desc";
    typeFilter?: string[];
    categoryFilter?: string;
    period: DashboardPeriod;
  }
): Promise<{ transactions: TransactionRecord[]; total: number }> {
  const startDate = periodStartDate(opts.period);

  // Fetch rows with SQL-compatible filters (date + category).
  // Type filtering is done in JS because sql`` doesn't support array params.
  // Since we decrypt + sort in memory anyway, this costs nothing extra.
  let result;
  if (startDate && opts.categoryFilter) {
    result = await sql`
      SELECT id, data_type, category, subcategory, amount, date, description, source
      FROM financial_data
      WHERE user_id = ${userId}
        AND date >= ${startDate}
        AND category = ${opts.categoryFilter}
      ORDER BY date DESC
    `;
  } else if (startDate) {
    result = await sql`
      SELECT id, data_type, category, subcategory, amount, date, description, source
      FROM financial_data
      WHERE user_id = ${userId}
        AND date >= ${startDate}
      ORDER BY date DESC
    `;
  } else if (opts.categoryFilter) {
    result = await sql`
      SELECT id, data_type, category, subcategory, amount, date, description, source
      FROM financial_data
      WHERE user_id = ${userId}
        AND category = ${opts.categoryFilter}
      ORDER BY date DESC
    `;
  } else {
    result = await sql`
      SELECT id, data_type, category, subcategory, amount, date, description, source
      FROM financial_data
      WHERE user_id = ${userId}
      ORDER BY date DESC
    `;
  }

  // Decrypt all rows and apply type filter in JS
  const typeSet = opts.typeFilter?.length
    ? new Set(opts.typeFilter)
    : null;

  const decrypted: TransactionRecord[] = [];
  for (const r of result.rows) {
    try {
      const raw = r as unknown as RawTransactionRow;

      // Apply type filter
      if (typeSet && !typeSet.has(raw.data_type)) continue;

      decrypted.push({
        id: raw.id,
        date: raw.date,
        dataType: raw.data_type as TransactionRecord["dataType"],
        category: raw.category,
        subcategory: raw.subcategory,
        amount: decryptNumber(raw.amount),
        description: raw.description,
        source: raw.source,
      });
    } catch {
      // Skip rows that fail decryption
    }
  }

  // Sort in JS (handles encrypted amount sorting + other columns)
  const sortKey = opts.sort;
  const dir = opts.order === "asc" ? 1 : -1;

  decrypted.sort((a, b) => {
    switch (sortKey) {
      case "amount":
        return (a.amount - b.amount) * dir;
      case "category":
        return a.category.localeCompare(b.category) * dir;
      case "dataType":
        return a.dataType.localeCompare(b.dataType) * dir;
      case "date":
      default:
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
    }
  });

  // Paginate
  const total = decrypted.length;
  const start = (opts.page - 1) * opts.pageSize;
  const transactions = decrypted.slice(start, start + opts.pageSize);

  return { transactions, total };
}

// ─── Get spending trends by category by month ───────────────────

export async function getSpendingTrends(
  userId: string,
  period: DashboardPeriod
): Promise<SpendingTrendsResponse> {
  const startDate = periodStartDate(period === "all" ? "6m" : period);

  const result = startDate
    ? await sql`
        SELECT category, amount, date
        FROM financial_data
        WHERE user_id = ${userId}
          AND data_type = 'expense'
          AND date >= ${startDate}
        ORDER BY date
      `
    : await sql`
        SELECT category, amount, date
        FROM financial_data
        WHERE user_id = ${userId}
          AND data_type = 'expense'
        ORDER BY date
      `;

  // Group by category + yearMonth
  const categoryMonthMap = new Map<string, Map<string, number>>();
  const allMonths = new Set<string>();
  const categoryTotals = new Map<string, number>();

  for (const r of result.rows) {
    try {
      const raw = r as unknown as { category: string; amount: string; date: string };
      const amount = decryptNumber(raw.amount);
      const d = new Date(raw.date);
      const ym = toYearMonth(d);

      allMonths.add(ym);

      if (!categoryMonthMap.has(raw.category)) {
        categoryMonthMap.set(raw.category, new Map());
      }
      const monthMap = categoryMonthMap.get(raw.category)!;
      monthMap.set(ym, (monthMap.get(ym) || 0) + amount);

      categoryTotals.set(raw.category, (categoryTotals.get(raw.category) || 0) + amount);
    } catch {
      // Skip decryption failures
    }
  }

  // Sort months chronologically
  const sortedMonths = Array.from(allMonths).sort();
  const monthLabels = sortedMonths.map(formatMonthLabel);

  // Sort categories by total spend, take top 8
  const sortedCategories = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const categories: SpendingTrendCategory[] = sortedCategories.map(([category]) => {
    const monthMap = categoryMonthMap.get(category)!;
    const months = sortedMonths.map((ym, i) => ({
      yearMonth: ym,
      label: monthLabels[i],
      amount: Math.round(monthMap.get(ym) || 0),
    }));

    // Compute trend from last two months
    let trendDirection: "increasing" | "decreasing" | "stable" = "stable";
    let changePercent = 0;

    if (sortedMonths.length >= 2) {
      const latest = monthMap.get(sortedMonths[sortedMonths.length - 1]) || 0;
      const prior = monthMap.get(sortedMonths[sortedMonths.length - 2]) || 0;

      if (prior > 0) {
        changePercent = Math.round(((latest - prior) / prior) * 100);
        if (changePercent > 5) trendDirection = "increasing";
        else if (changePercent < -5) trendDirection = "decreasing";
      } else if (latest > 0) {
        changePercent = 100;
        trendDirection = "increasing";
      }
    }

    return { category, months, trendDirection, changePercent };
  });

  return { categories, months: monthLabels };
}
