"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "./chart-card";
import { formatCurrency } from "@/lib/utils/format";
import type { CashFlowItem } from "@/types/financial";

const PLACEHOLDER_DATA: CashFlowItem[] = [
  { name: "Salary", value: 8500 },
  { name: "Dividends", value: 350 },
  { name: "Housing", value: -2200 },
  { name: "Food", value: -800 },
  { name: "Transport", value: -450 },
  { name: "Utilities", value: -320 },
  { name: "Subscriptions", value: -180 },
  { name: "Other", value: -600 },
  { name: "Net", value: 4300 },
];

interface CashFlowCardProps {
  data?: CashFlowItem[];
  loading?: boolean;
  onCategoryClick?: (category: string) => void;
}

export function CashFlowCard({
  data = PLACEHOLDER_DATA,
  loading = false,
  onCategoryClick,
}: CashFlowCardProps) {
  return (
    <ChartCard
      title="Monthly Cash Flow"
      description="Income sources and expense categories"
      loading={loading}
      className="col-span-full"
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="name"
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
          <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Amount">
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  entry.name === "Net"
                    ? "oklch(0.55 0.22 265)"
                    : entry.value >= 0
                    ? "oklch(0.65 0.2 160)"
                    : "oklch(0.62 0.2 15)"
                }
                cursor={entry.name !== "Net" ? "pointer" : undefined}
                onClick={() => {
                  if (entry.name !== "Net" && onCategoryClick) {
                    onCategoryClick(entry.name);
                  }
                }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
