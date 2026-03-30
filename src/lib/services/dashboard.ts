/**
 * Dashboard Service — thin wrapper around existing dashboard data functions.
 *
 * Provides a channel-agnostic interface for retrieving dashboard data.
 * Both the web dashboard route and the Telegram handler use this.
 */

import { getDashboardData as getDashboardDataFromDb } from "@/lib/db/dashboard";
import type { DashboardData, DashboardPeriod } from "@/types/financial";

export async function getDashboard(
  userId: string,
  period: DashboardPeriod = "all"
): Promise<DashboardData> {
  return getDashboardDataFromDb(userId, period);
}

/**
 * Generate a text-based summary suitable for Telegram messages.
 * Condensed version of dashboard data without charts.
 */
export function formatDashboardSummary(data: DashboardData): string {
  if (!data.hasData) {
    return "No financial data available yet. Upload some documents to get started.";
  }

  const s = data.summary;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  const lines: string[] = [];

  lines.push(`Net Worth: ${fmt(s.netWorth)}`);
  lines.push(`Assets: ${fmt(s.totalAssets)} | Liabilities: ${fmt(s.totalLiabilities)}`);
  lines.push("");
  lines.push(`Monthly Income: ${fmt(s.monthlyIncome)}`);
  lines.push(`Monthly Expenses: ${fmt(s.monthlyExpenses)}`);
  lines.push(`Savings Rate: ${s.savingsRate.toFixed(1)}%`);

  if (data.portfolioAllocation.length > 0) {
    lines.push("");
    lines.push("Portfolio:");
    for (const a of data.portfolioAllocation.slice(0, 5)) {
      lines.push(`  ${a.assetClass}: ${fmt(a.value)} (${a.percentage.toFixed(1)}%)`);
    }
  }

  if (data.recommendations.length > 0) {
    lines.push("");
    lines.push("Recommendations:");
    for (const r of data.recommendations) {
      const icon = r.priority === "high" ? "!" : r.priority === "medium" ? "*" : "-";
      lines.push(`  ${icon} ${r.text}`);
    }
  }

  return lines.join("\n");
}

/**
 * Render a text-based chart for Telegram (Phase 1: Unicode block characters).
 * Returns a monospace-formatted string.
 */
export function renderTextChart(params: {
  title: string;
  items: Array<{ label: string; value: number }>;
  maxWidth?: number;
}): string {
  const { title, items, maxWidth = 20 } = params;
  if (items.length === 0) return `${title}\n(no data)`;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  const total = items.reduce((sum, i) => sum + Math.abs(i.value), 0);
  const maxVal = Math.max(...items.map((i) => Math.abs(i.value)));
  const maxLabelLen = Math.max(...items.map((i) => i.label.length));

  const lines: string[] = [title, ""];

  for (const item of items) {
    const label = item.label.padEnd(maxLabelLen);
    const amount = fmt(item.value).padStart(10);
    const barLen = maxVal > 0 ? Math.round((Math.abs(item.value) / maxVal) * maxWidth) : 0;
    const bar = "\u2588".repeat(barLen);
    const pct = total > 0 ? Math.round((Math.abs(item.value) / total) * 100) : 0;
    lines.push(`${label} ${amount}  ${bar} ${pct}%`);
  }

  return lines.join("\n");
}
