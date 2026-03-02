import { sql } from "./index";
import { decryptNumber } from "./encryption";

export interface ChartDataParams {
  dataTypes: string[];
  categories?: string[];
  groupBy: "month" | "category" | "week" | "day";
  monthsBack: number;
}

export interface ChartDataPoint {
  label: string;
  [key: string]: string | number;
}

export async function queryFinancialDataForChart(
  userId: string,
  params: ChartDataParams
): Promise<ChartDataPoint[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - params.monthsBack);
  const startStr = startDate.toISOString().split("T")[0];

  // Build data type filter
  const typeList = params.dataTypes.length > 0 ? params.dataTypes : ["expense"];

  // Query raw data
  const result = await sql`
    SELECT data_type, category, amount, date
    FROM financial_data
    WHERE user_id = ${userId}
      AND date >= ${startStr}
    ORDER BY date
  `;

  // Decrypt and filter in-app (since we can't filter encrypted columns in SQL)
  interface RawRow {
    dataType: string;
    category: string;
    amount: number;
    date: Date;
  }

  const rows: RawRow[] = [];
  for (const r of result.rows) {
    const dataType = r.data_type as string;
    if (!typeList.includes(dataType)) continue;

    if (
      params.categories &&
      params.categories.length > 0 &&
      !params.categories.some(
        (c) =>
          (r.category as string).toLowerCase().includes(c.toLowerCase())
      )
    ) {
      continue;
    }

    try {
      rows.push({
        dataType,
        category: r.category as string,
        amount: decryptNumber(r.amount as string),
        date: new Date(r.date as string),
      });
    } catch {
      // Skip
    }
  }

  // Group by the specified dimension
  switch (params.groupBy) {
    case "month":
      return groupByMonth(rows);
    case "category":
      return groupByCategory(rows);
    case "week":
      return groupByWeek(rows);
    case "day":
      return groupByDay(rows);
    default:
      return groupByMonth(rows);
  }
}

interface RawRow {
  dataType: string;
  category: string;
  amount: number;
  date: Date;
}

function groupByMonth(rows: RawRow[]): ChartDataPoint[] {
  const groups = new Map<string, Map<string, number>>();
  const allCategories = new Set<string>();

  for (const r of rows) {
    const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, "0")}`;
    const label = r.date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    if (!groups.has(key)) groups.set(key, new Map([["_label", 0]]));
    const group = groups.get(key)!;
    group.set("_label", 0);
    group.set(r.category, (group.get(r.category) || 0) + r.amount);
    allCategories.add(r.category);
  }

  const sorted = Array.from(groups.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return sorted.map(([key, cats]) => {
    const [year, month] = key.split("-");
    const d = new Date(Number(year), Number(month) - 1);
    const point: ChartDataPoint = {
      label: d.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      }),
    };
    for (const cat of allCategories) {
      point[cat] = Math.round(cats.get(cat) || 0);
    }
    return point;
  });
}

function groupByCategory(rows: RawRow[]): ChartDataPoint[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    totals.set(r.category, (totals.get(r.category) || 0) + r.amount);
  }

  return Array.from(totals.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([category, amount]) => ({
      label: category,
      amount: Math.round(amount),
    }));
}

function groupByWeek(rows: RawRow[]): ChartDataPoint[] {
  const groups = new Map<string, number>();
  for (const r of rows) {
    const startOfWeek = new Date(r.date);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const key = startOfWeek.toISOString().split("T")[0];
    groups.set(key, (groups.get(key) || 0) + r.amount);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({
      label: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      amount: Math.round(amount),
    }));
}

function groupByDay(rows: RawRow[]): ChartDataPoint[] {
  const groups = new Map<string, number>();
  for (const r of rows) {
    const key = r.date.toISOString().split("T")[0];
    groups.set(key, (groups.get(key) || 0) + r.amount);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({
      label: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      amount: Math.round(amount),
    }));
}
