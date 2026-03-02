import Anthropic from "@anthropic-ai/sdk";
import { buildFinancialContext } from "./context";
import type { DashboardData, Goal } from "@/types/financial";

const anthropic = new Anthropic();

const GOAL_TYPE_LABELS: Record<string, string> = {
  emergency_fund: "Emergency Fund",
  debt_payoff: "Debt Payoff",
  savings: "Savings Target",
  net_worth: "Net Worth Target",
  retirement: "Retirement",
  custom: "Custom Goal",
};

export async function generateGoalInsight(
  goal: Goal,
  dashboardData: DashboardData
): Promise<string> {
  const financialContext = buildFinancialContext(dashboardData);
  const progress =
    goal.targetAmount > 0
      ? ((goal.currentAmount / goal.targetAmount) * 100).toFixed(1)
      : "0";
  const remaining = goal.targetAmount - goal.currentAmount;

  const userPrompt = `
Goal: ${goal.name}
Type: ${GOAL_TYPE_LABELS[goal.goalType] || goal.goalType}
Target: $${goal.targetAmount.toLocaleString()}
Current: $${goal.currentAmount.toLocaleString()}
Progress: ${progress}%
Remaining: $${remaining.toLocaleString()}
Deadline: ${goal.deadline || "No deadline set"}
Created: ${goal.createdAt.split("T")[0]}

${financialContext}

Give a brief, actionable financial tip (2-3 sentences) for this specific goal based on the user's financial data. Reference specific numbers. Be encouraging but realistic.
  `.trim();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 256,
    temperature: 0.3,
    system:
      "You are a concise financial advisor. Give brief, actionable tips for financial goals. Reference the user's actual numbers. Max 2-3 sentences. Do not use markdown formatting.",
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type === "text") {
    return block.text.trim();
  }
  return "Unable to generate insight at this time.";
}
