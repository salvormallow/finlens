// ─── Recurring Expense Detection ─────────────────────────────────

export interface DecryptedExpense {
  id: string;
  category: string;
  amount: number;
  date: string;
  description: string | null;
}

export type RecurringFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "annual";

export interface RecurringExpense {
  id: string;
  description: string;
  category: string;
  frequency: RecurringFrequency;
  averageAmount: number;
  lastAmount: number;
  lastDate: string;
  monthlyEquivalent: number;
  priceChange: number | null;
  status: "active" | "possibly_inactive";
  occurrences: number;
}

export interface RecurringExpensesResponse {
  subscriptions: RecurringExpense[];
  monthlyTotal: number;
  annualTotal: number;
}

// Normalize description for grouping
function normalizeDescription(desc: string | null, category: string): string {
  if (!desc) return category.toLowerCase();
  return desc
    .toLowerCase()
    .replace(/\d{4,}/g, "") // strip long numbers (transaction IDs)
    .replace(/\s+/g, " ")
    .replace(/[#*]/g, "")
    .trim();
}

// Detect frequency from median interval between transactions
function detectFrequency(
  intervalDays: number
): RecurringFrequency | null {
  if (intervalDays >= 5 && intervalDays <= 9) return "weekly";
  if (intervalDays >= 12 && intervalDays <= 18) return "biweekly";
  if (intervalDays >= 25 && intervalDays <= 38) return "monthly";
  if (intervalDays >= 80 && intervalDays <= 100) return "quarterly";
  if (intervalDays >= 340 && intervalDays <= 400) return "annual";
  return null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function monthlyEquivalentFromFrequency(
  freq: RecurringFrequency,
  amount: number
): number {
  switch (freq) {
    case "weekly":
      return amount * 4.33;
    case "biweekly":
      return amount * 2.17;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "annual":
      return amount / 12;
  }
}

export function detectRecurringExpenses(
  rows: DecryptedExpense[]
): RecurringExpensesResponse {
  // Group by normalized description
  const groups = new Map<string, DecryptedExpense[]>();
  for (const row of rows) {
    const key = normalizeDescription(row.description, row.category);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const subscriptions: RecurringExpense[] = [];

  for (const [key, txns] of groups) {
    // Need at least 3 occurrences to detect a pattern
    if (txns.length < 3) continue;

    // Sort by date ascending
    const sorted = [...txns].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Compute intervals between consecutive transactions
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days =
        (new Date(sorted[i].date).getTime() -
          new Date(sorted[i - 1].date).getTime()) /
        (1000 * 60 * 60 * 24);
      intervals.push(days);
    }

    const medianInterval = median(intervals);
    const frequency = detectFrequency(medianInterval);
    if (!frequency) continue;

    // Check amount consistency (stddev / mean < 0.3 — allow some variance)
    const amounts = sorted.map((t) => t.amount);
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const variance =
      amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
    const stddev = Math.sqrt(variance);
    if (mean > 0 && stddev / mean > 0.5) continue; // too much variance

    // Detect price change: last 3 avg vs prior 3 avg
    let priceChange: number | null = null;
    if (sorted.length >= 6) {
      const recent3 = sorted.slice(-3);
      const prior3 = sorted.slice(-6, -3);
      const recentAvg =
        recent3.reduce((s, t) => s + t.amount, 0) / recent3.length;
      const priorAvg =
        prior3.reduce((s, t) => s + t.amount, 0) / prior3.length;
      if (priorAvg > 0) {
        const pct = Math.round(((recentAvg - priorAvg) / priorAvg) * 100);
        if (Math.abs(pct) >= 3) priceChange = pct;
      }
    }

    // Detect inactive: last charge > 1.5x median interval ago
    const lastDate = sorted[sorted.length - 1].date;
    const daysSinceLast =
      (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
    const status: "active" | "possibly_inactive" =
      daysSinceLast > medianInterval * 1.5 ? "possibly_inactive" : "active";

    const lastAmount = sorted[sorted.length - 1].amount;
    const monthlyEq = Math.round(
      monthlyEquivalentFromFrequency(frequency, mean)
    );

    // Use the original description from the most recent transaction
    const displayName =
      sorted[sorted.length - 1].description || key;

    subscriptions.push({
      id: key.replace(/[^a-z0-9]/g, "-").slice(0, 40),
      description: displayName,
      category: sorted[sorted.length - 1].category,
      frequency,
      averageAmount: Math.round(mean * 100) / 100,
      lastAmount: Math.round(lastAmount * 100) / 100,
      lastDate,
      monthlyEquivalent: monthlyEq,
      priceChange,
      status,
      occurrences: sorted.length,
    });
  }

  // Sort by monthly cost descending
  subscriptions.sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);

  const monthlyTotal = subscriptions.reduce(
    (s, sub) => s + sub.monthlyEquivalent,
    0
  );

  return {
    subscriptions,
    monthlyTotal: Math.round(monthlyTotal),
    annualTotal: Math.round(monthlyTotal * 12),
  };
}
