import Anthropic from "@anthropic-ai/sdk";
import type { ForecastResult } from "@/lib/analysis/forecast";

const anthropic = new Anthropic();

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export async function generateForecastInsights(
  result: ForecastResult,
  horizonDays: number
): Promise<string> {
  const netChange = result.endBalance - result.startBalance;
  const warningCount = result.lowBalanceWarnings.length;

  const lines: string[] = [];
  lines.push(`--- CASH FLOW FORECAST (${horizonDays} days) ---`);
  lines.push(
    `Starting Balance: ${fmt(result.startBalance)} → Projected End Balance: ${fmt(result.endBalance)}`
  );
  lines.push(
    `Net Change: ${fmt(netChange)} (${netChange >= 0 ? "positive" : "negative"})`
  );
  lines.push(`Expected Income: ${fmt(result.totalExpectedIncome)}`);
  lines.push(`Expected Expenses: ${fmt(result.totalExpectedExpenses)}`);

  if (warningCount > 0) {
    lines.push("");
    lines.push(`LOW BALANCE WARNINGS (${warningCount}):`);
    for (const w of result.lowBalanceWarnings) {
      lines.push(`  - ${w.date}: projected balance ${fmt(w.projected)}`);
    }
  }

  const prompt = `You are a concise financial analyst. Based on this cash flow forecast, provide a 2-3 sentence insight. Highlight the most important trend and any risk. If there are low balance warnings, suggest a specific action. Be direct and use the actual numbers.

${lines.join("\n")}

Respond with ONLY the insight text, no markdown formatting or bullet points.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}
