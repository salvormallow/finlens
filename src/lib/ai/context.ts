import type { DashboardData } from "@/types/financial";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function buildFinancialContext(data: DashboardData): string {
  if (!data.hasData) {
    return "No financial data available. The user has not uploaded any documents yet.";
  }

  const s = data.summary;
  const lines: string[] = [];

  // Snapshot
  lines.push("--- FINANCIAL SNAPSHOT ---");
  lines.push(
    `Net Worth: ${fmt(s.netWorth)} | Assets: ${fmt(s.totalAssets)} | Liabilities: ${fmt(s.totalLiabilities)}`
  );
  lines.push(
    `Monthly Income: ${fmt(s.monthlyIncome)} | Monthly Expenses: ${fmt(s.monthlyExpenses)} | Savings Rate: ${s.savingsRate.toFixed(1)}%`
  );

  // Monthly P&L
  if (data.monthlyPnL.length > 0) {
    lines.push("");
    lines.push("--- MONTHLY P&L ---");
    for (const m of data.monthlyPnL) {
      lines.push(
        `${m.month}: Income ${fmt(m.income)}, Expenses ${fmt(m.expenses)}, Net ${fmt(m.net)}`
      );
    }
  }

  // Portfolio allocation
  if (data.portfolioAllocation.length > 0) {
    lines.push("");
    lines.push("--- PORTFOLIO ALLOCATION ---");
    for (const a of data.portfolioAllocation) {
      lines.push(`${a.assetClass}: ${fmt(a.value)} (${a.percentage.toFixed(1)}%)`);
    }
  }

  // Cash flow
  if (data.cashFlow.length > 0) {
    lines.push("");
    lines.push("--- CASH FLOW BREAKDOWN (most recent month) ---");
    for (const c of data.cashFlow) {
      lines.push(`${c.name}: ${fmt(c.value)}`);
    }
  }

  // Tax overview
  lines.push("");
  lines.push("--- TAX OVERVIEW ---");
  if (data.taxOverview.hasData) {
    lines.push(
      `Estimated Liability: ${fmt(data.taxOverview.estimatedLiability)} | Withholdings YTD: ${fmt(data.taxOverview.withholdingsYtd)} | Balance Due: ${fmt(data.taxOverview.estimatedBalanceDue)}`
    );
  } else {
    lines.push("No tax documents uploaded yet.");
  }

  // Net worth trend
  if (data.netWorthTrend.length > 0) {
    lines.push("");
    lines.push("--- NET WORTH TREND ---");
    for (const t of data.netWorthTrend) {
      lines.push(
        `${t.date}: Assets ${fmt(t.assets)}, Liabilities ${fmt(t.liabilities)}, Net Worth ${fmt(t.netWorth)}`
      );
    }
  }

  return lines.join("\n");
}
