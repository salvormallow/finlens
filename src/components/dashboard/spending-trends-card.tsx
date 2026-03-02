"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { ChartCard } from "./chart-card";
import { formatCurrency } from "@/lib/utils/format";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type {
  DashboardPeriod,
  SpendingTrendsResponse,
} from "@/types/financial";

const COLORS = [
  "hsl(0, 84%, 60%)",
  "hsl(38, 92%, 50%)",
  "hsl(262, 83%, 58%)",
  "hsl(217, 91%, 60%)",
  "hsl(142, 76%, 36%)",
  "hsl(180, 70%, 45%)",
  "hsl(330, 70%, 50%)",
  "hsl(60, 70%, 45%)",
];

interface SpendingTrendsCardProps {
  period: DashboardPeriod;
}

export function SpendingTrendsCard({ period }: SpendingTrendsCardProps) {
  const [data, setData] = useState<SpendingTrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard/spending-trends?period=${period}`
      );
      if (!res.ok) throw new Error();
      const json: SpendingTrendsResponse = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Don't render if no data
  if (!loading && (!data || data.categories.length === 0)) {
    return null;
  }

  // Transform data for stacked bar chart: each month is a row, each category is a key
  const chartData =
    data?.months.map((label, idx) => {
      const row: Record<string, string | number> = { month: label };
      for (const cat of data.categories) {
        row[cat.category] = cat.months[idx]?.amount || 0;
      }
      return row;
    }) || [];

  return (
    <ChartCard
      title="Spending Trends"
      description="Month-over-month spending by category"
      loading={loading}
      className="col-span-full"
    >
      {data && (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border"
              />
              <XAxis
                dataKey="month"
                className="text-xs fill-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                className="text-xs fill-muted-foreground"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrency(v, { compact: true })}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value) => [
                  formatCurrency(Number(value)),
                  "",
                ]}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                wrapperStyle={{ fontSize: "11px" }}
              />
              {data.categories.map((cat, i) => (
                <Bar
                  key={cat.category}
                  dataKey={cat.category}
                  stackId="spending"
                  fill={COLORS[i % COLORS.length]}
                  radius={
                    i === data.categories.length - 1 ? [4, 4, 0, 0] : undefined
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>

          {/* Trend indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {data.categories.map((cat) => (
              <div
                key={cat.category}
                className="flex items-center gap-2 text-xs"
              >
                {cat.trendDirection === "increasing" ? (
                  <TrendingUp className="h-3.5 w-3.5 text-red-500 shrink-0" />
                ) : cat.trendDirection === "decreasing" ? (
                  <TrendingDown className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="text-muted-foreground truncate">
                  {cat.category}
                </span>
                <span
                  className={`ml-auto font-medium shrink-0 ${
                    cat.trendDirection === "increasing"
                      ? "text-red-500"
                      : cat.trendDirection === "decreasing"
                      ? "text-emerald-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {cat.changePercent > 0 ? "+" : ""}
                  {cat.changePercent}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </ChartCard>
  );
}
