import type { DashboardData, AdvisorClientProfile, AdvisorMemoryNote } from "@/types/financial";

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

  // Data coverage assessment
  const gaps: string[] = [];
  if (s.monthlyIncome === 0) gaps.push("No income data for the current month");
  if (s.monthlyExpenses === 0) gaps.push("No expense data for the current month");
  if (!data.taxOverview.hasData) gaps.push("No tax documents (W-2, 1099)");
  if (data.portfolioAllocation.length === 0) gaps.push("No investment/portfolio data");
  if (data.monthlyPnL.length < 3) gaps.push(`Only ${data.monthlyPnL.length} month(s) of transaction history`);
  if (data.netWorthTrend.length < 3) gaps.push(`Only ${data.netWorthTrend.length} month(s) of net worth history`);

  lines.push("--- DATA COVERAGE ---");
  if (gaps.length > 0) {
    lines.push(`GAPS (data NOT yet uploaded): ${gaps.join("; ")}`);
    lines.push("Answers should account for these missing data points.");
  } else {
    lines.push("Data appears comprehensive across income, expenses, tax, and investments.");
  }
  lines.push("");

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

const CATEGORY_LABELS: Record<string, string> = {
  life_event: "Life Events",
  financial_plan: "Financial Plans",
  correction: "Corrections",
  preference: "Preferences",
  follow_up: "Follow-ups",
  pattern: "Observed Patterns",
};

const LIFE_STAGE_LABELS: Record<string, string> = {
  early_career: "Early career",
  mid_career: "Mid-career",
  pre_retirement: "Pre-retirement",
  retired: "Retired",
};

export function buildMemoryBrief(
  profile: AdvisorClientProfile | null,
  notes: AdvisorMemoryNote[]
): string {
  const lines: string[] = [];

  lines.push("--- CLIENT MEMORY BRIEF ---");
  lines.push("Use this to personalize your responses. You wrote these notes from previous conversations.");

  // Profile section
  if (profile) {
    const profileParts: string[] = [];
    if (profile.lifeStage) profileParts.push(LIFE_STAGE_LABELS[profile.lifeStage] || profile.lifeStage);
    if (profile.riskTolerance) profileParts.push(`${profile.riskTolerance} risk tolerance`);
    if (profile.communicationPreference) profileParts.push(`prefers ${profile.communicationPreference} communication`);
    if (profile.financialLiteracy) profileParts.push(`${profile.financialLiteracy} financial literacy`);

    if (profileParts.length > 0) {
      lines.push("");
      lines.push(`Profile: ${profileParts.join(", ")}`);
    }

    if (profile.householdInfo) {
      const info = profile.householdInfo;
      const parts: string[] = [];
      if (info.family_size) parts.push(`family of ${info.family_size}`);
      if (info.dependents) parts.push(`${info.dependents} dependents`);
      if (info.partner_income) parts.push(`partner income noted`);
      if (parts.length > 0) {
        lines.push(`Household: ${parts.join(", ")}`);
      }
    }

    if (profile.keyGoalsSummary) {
      lines.push(`Goals Summary: ${profile.keyGoalsSummary}`);
    }

    if (profile.lastConfirmedAt) {
      const confirmedDate = new Date(profile.lastConfirmedAt);
      const daysSinceConfirm = Math.floor((Date.now() - confirmedDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceConfirm > 90) {
        lines.push(`NOTE: Profile was last confirmed ${daysSinceConfirm} days ago. Consider a check-in to verify this information is still accurate.`);
      }
    }
  }

  // Notes section grouped by category
  if (notes.length > 0) {
    const grouped = new Map<string, AdvisorMemoryNote[]>();
    for (const note of notes) {
      const existing = grouped.get(note.category) || [];
      existing.push(note);
      grouped.set(note.category, existing);
    }

    for (const [category, categoryNotes] of grouped) {
      lines.push("");
      lines.push(`${CATEGORY_LABELS[category] || category}:`);
      for (const note of categoryNotes) {
        lines.push(`  - [${note.id}] ${note.content}`);
      }
    }
  }

  if (!profile && notes.length === 0) {
    lines.push("");
    lines.push("No client memory yet. As you learn important facts about this client, use the save_memory tool to remember them.");
  }

  return lines.join("\n");
}
