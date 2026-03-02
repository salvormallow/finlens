"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "./chart-card";
import { formatCurrency } from "@/lib/utils/format";
import type { NetWorthTrend } from "@/types/financial";

// Placeholder data for the dashboard shell
const PLACEHOLDER_DATA: NetWorthTrend[] = [
  { date: "Jul 2025", assets: 185000, liabilities: 42000, netWorth: 143000 },
  { date: "Aug 2025", assets: 190000, liabilities: 41000, netWorth: 149000 },
  { date: "Sep 2025", assets: 188000, liabilities: 40000, netWorth: 148000 },
  { date: "Oct 2025", assets: 195000, liabilities: 39000, netWorth: 156000 },
  { date: "Nov 2025", assets: 201000, liabilities: 38000, netWorth: 163000 },
  { date: "Dec 2025", assets: 210000, liabilities: 37000, netWorth: 173000 },
];

interface NetWorthCardProps {
  data?: NetWorthTrend[];
  loading?: boolean;
}

export function NetWorthCard({
  data = PLACEHOLDER_DATA,
  loading = false,
}: NetWorthCardProps) {
  return (
    <ChartCard
      title="Net Worth Trend"
      description="Assets vs liabilities over time"
      loading={loading}
      className="col-span-full lg:col-span-2"
    >
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.65 0.2 160)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="oklch(0.65 0.2 160)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.55 0.22 265)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="oklch(0.55 0.22 265)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
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
          <Area
            type="monotone"
            dataKey="assets"
            stroke="oklch(0.65 0.2 160)"
            fillOpacity={1}
            fill="url(#colorAssets)"
            name="Assets"
          />
          <Area
            type="monotone"
            dataKey="netWorth"
            stroke="oklch(0.55 0.22 265)"
            fillOpacity={1}
            fill="url(#colorNetWorth)"
            name="Net Worth"
          />
          <Area
            type="monotone"
            dataKey="liabilities"
            stroke="oklch(0.62 0.2 15)"
            fillOpacity={0}
            name="Liabilities"
            strokeDasharray="5 5"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
