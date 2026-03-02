"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format";

interface SeriesConfig {
  key: string;
  color: string;
  label: string;
}

interface ChartConfig {
  chartType: "bar" | "line" | "area" | "pie" | "stacked_bar";
  title: string;
  data: Record<string, string | number>[];
  series: SeriesConfig[];
}

const tooltipStyle = {
  backgroundColor: "oklch(0.17 0.015 265 / 0.95)",
  border: "1px solid oklch(0.35 0.025 265 / 0.3)",
  borderRadius: "10px",
  fontSize: "12px",
};

export function InlineChart({ config }: { config: ChartConfig }) {
  const { chartType, title, data, series } = config;

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
        No data available for this chart.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm p-4 my-2">
      <h4 className="text-sm font-medium mb-3 text-foreground">{title}</h4>
      <ResponsiveContainer width="100%" height={220}>
        {chartType === "pie" ? (
          <PieChart>
            <Pie
              data={data}
              dataKey={series[0]?.key || "amount"}
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={(props) => {
                const name = (props as { name?: string }).name ?? "";
                const percent = (props as { percent?: number }).percent ?? 0;
                return `${name} ${(percent * 100).toFixed(0)}%`;
              }}
              labelLine={false}
            >
              {data.map((_, idx) => (
                <Cell
                  key={idx}
                  fill={series[idx % series.length]?.color || `oklch(0.55 0.22 ${265 + idx * 40})`}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [formatCurrency(value as number), ""]}
            />
          </PieChart>
        ) : chartType === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              className="text-[10px] fill-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              className="text-[10px] fill-muted-foreground"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCurrency(v, { compact: true })}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [formatCurrency(value as number), ""]}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                name={s.label}
              />
            ))}
          </LineChart>
        ) : chartType === "area" ? (
          <AreaChart data={data}>
            <defs>
              {series.map((s) => (
                <linearGradient
                  key={s.key}
                  id={`chartGrad-${s.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              className="text-[10px] fill-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              className="text-[10px] fill-muted-foreground"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCurrency(v, { compact: true })}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [formatCurrency(value as number), ""]}
            />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                fillOpacity={1}
                fill={`url(#chartGrad-${s.key})`}
                name={s.label}
              />
            ))}
          </AreaChart>
        ) : (
          /* bar and stacked_bar */
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              className="text-[10px] fill-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              className="text-[10px] fill-muted-foreground"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCurrency(v, { compact: true })}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [formatCurrency(value as number), ""]}
            />
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                name={s.label}
                stackId={chartType === "stacked_bar" ? "stack" : undefined}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
