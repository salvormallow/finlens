import Anthropic from "@anthropic-ai/sdk";
import { buildFinancialContext } from "./context";
import type { DashboardData } from "@/types/financial";

const anthropic = new Anthropic();

export type ReportTone = "concise" | "detailed";

const SYSTEM_PROMPT = `You are a personal financial analyst writing a monthly financial digest for a client. Write in a professional but approachable tone. Use the client's actual numbers and data.

Structure your report with these sections (use markdown headings):

## Summary
A 2-3 sentence executive summary of the month.

## Income & Spending
Analyze income sources and spending patterns. Call out notable changes.

## Notable Transactions
Flag any unusually large, new, or missing transactions compared to historical patterns.

## Portfolio & Net Worth
Comment on investment performance and net worth trajectory. Skip if no investment data.

## Observations & Outlook
Key takeaways and what to watch for next month. Include 1-2 actionable suggestions.

RULES:
- Use SPECIFIC dollar amounts from the data
- Compare to prior months when data is available
- If data is limited, acknowledge gaps instead of fabricating
- Keep each section focused and avoid repetition
- Use bullet points for lists, bold for emphasis
- Do NOT include a title/header — the UI handles that`;

export async function generateNarrativeReport(
  dashboardData: DashboardData,
  options: { tone: ReportTone; period: string }
): Promise<string> {
  const financialContext = buildFinancialContext(dashboardData);

  const maxTokens = options.tone === "concise" ? 1500 : 3000;

  const userPrompt = `Generate a ${options.tone} monthly financial report for the period: ${options.period}.

${options.tone === "concise" ? "Keep each section to 2-3 sentences. Be direct." : "Provide thorough analysis in each section with specific comparisons and recommendations."}

Financial data:

${financialContext}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    temperature: 0.4,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}
