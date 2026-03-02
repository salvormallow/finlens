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
}

export function CashFlowCard({
  data = PLACEHOLDER_DATA,
  loading = false,
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
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
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
                    ? "hsl(217, 91%, 60%)"
                    : entry.value >= 0
                    ? "hsl(142, 76%, 36%)"
                    : "hsl(0, 84%, 60%)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
