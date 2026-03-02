"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { ChartCard } from "./chart-card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/format";
import { AlertTriangle, Bot, TrendingUp } from "lucide-react";

interface ForecastPoint {
  date: string;
  projected: number;
  high: number;
  low: number;
}

interface LowBalanceWarning {
  date: string;
  projected: number;
}

interface ForecastData {
  points: ForecastPoint[];
  startBalance: number;
  endBalance: number;
  totalExpectedIncome: number;
  totalExpectedExpenses: number;
  lowBalanceWarnings: LowBalanceWarning[];
  insights: string | null;
  horizon: number;
}

type Horizon = 30 | 60 | 90;

export function ForecastCard() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState<Horizon>(30);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/forecast?horizon=${horizon}`);
      if (!res.ok) return;
      const json: ForecastData = await res.json();
      setData(json);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [horizon]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  const hasWarnings = data && data.lowBalanceWarnings.length > 0;

  return (
    <ChartCard
      title="Cash Flow Forecast"
      description="Projected balance with confidence bands"
      loading={loading}
      action={
        <div className="flex gap-1">
          {([30, 60, 90] as Horizon[]).map((h) => (
            <Button
              key={h}
              variant={horizon === h ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setHorizon(h)}
            >
              {h}d
            </Button>
          ))}
        </div>
      }
    >
      {data && data.points.length > 0 ? (
        <div className="space-y-4">
          {/* Summary Row */}
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: "oklch(0.55 0.22 265)" }} />
              <span className="text-muted-foreground">
                Start: <span className="text-foreground font-medium">{formatCurrency(data.startBalance)}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                End: <span className="text-foreground font-medium">{formatCurrency(data.endBalance)}</span>
              </span>
            </div>
            {hasWarnings && (
              <div className="flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                <span>{data.lowBalanceWarnings.length} low balance alert{data.lowBalanceWarnings.length > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.points}>
              <defs>
                <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.55 0.22 265)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.55 0.22 265)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.55 0.22 265)" stopOpacity={0.08} />
                  <stop offset="95%" stopColor="oklch(0.55 0.22 265)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                className="text-xs fill-muted-foreground"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                interval={Math.floor(data.points.length / 6)}
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
                formatter={(value, name) => {
                  const label =
                    name === "projected"
                      ? "Projected"
                      : name === "high"
                      ? "Optimistic"
                      : "Conservative";
                  return [formatCurrency(value as number), label];
                }}
                labelFormatter={(label) => {
                  const d = new Date(label);
                  return d.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              {/* Low balance reference line */}
              <ReferenceLine
                y={500}
                stroke="oklch(0.7 0.18 75)"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
              {/* High band */}
              <Area
                type="monotone"
                dataKey="high"
                stroke="oklch(0.55 0.22 265)"
                strokeOpacity={0.2}
                strokeWidth={1}
                fillOpacity={1}
                fill="url(#colorBand)"
                name="high"
              />
              {/* Low band */}
              <Area
                type="monotone"
                dataKey="low"
                stroke="oklch(0.55 0.22 265)"
                strokeOpacity={0.2}
                strokeWidth={1}
                fillOpacity={0}
                fill="transparent"
                name="low"
              />
              {/* Projected line (main) */}
              <Area
                type="monotone"
                dataKey="projected"
                stroke="oklch(0.55 0.22 265)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorProjected)"
                name="projected"
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* AI Insights */}
          {data.insights && (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-sm">
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3 w-3 text-white" />
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {data.insights}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
          Upload bank statements to see cash flow projections
        </div>
      )}
    </ChartCard>
  );
}
