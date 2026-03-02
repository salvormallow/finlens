"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "./chart-card";
import { formatCurrency } from "@/lib/utils/format";
import type { MonthlyPnL } from "@/types/financial";

const PLACEHOLDER_DATA: MonthlyPnL[] = [
  { month: "Jul", income: 8500, expenses: 5200, net: 3300 },
  { month: "Aug", income: 8500, expenses: 4800, net: 3700 },
  { month: "Sep", income: 8500, expenses: 6100, net: 2400 },
  { month: "Oct", income: 9200, expenses: 5400, net: 3800 },
  { month: "Nov", income: 8500, expenses: 7200, net: 1300 },
  { month: "Dec", income: 11000, expenses: 8400, net: 2600 },
];

interface IncomeExpenseCardProps {
  data?: MonthlyPnL[];
  loading?: boolean;
}

export function IncomeExpenseCard({
  data = PLACEHOLDER_DATA,
  loading = false,
}: IncomeExpenseCardProps) {
  return (
    <ChartCard
      title="Income vs Expenses"
      description="Monthly comparison"
      loading={loading}
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
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
              backgroundColor: "oklch(0.17 0.015 265 / 0.95)",
              border: "1px solid oklch(0.35 0.025 265 / 0.3)",
              borderRadius: "10px",
              fontSize: "12px",
            }}
            formatter={(value) => [formatCurrency(value as number), ""]}
          />
          <Bar
            dataKey="income"
            fill="oklch(0.65 0.2 160)"
            radius={[4, 4, 0, 0]}
            name="Income"
          />
          <Bar
            dataKey="expenses"
            fill="oklch(0.62 0.2 15)"
            radius={[4, 4, 0, 0]}
            name="Expenses"
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
