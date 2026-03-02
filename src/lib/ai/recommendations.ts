import Anthropic from "@anthropic-ai/sdk";
import { parseJsonResponse } from "./extract";
import { buildFinancialContext } from "./context";
import type { DashboardData, Recommendation, Priority } from "@/types/financial";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a certified financial planner analyzing a client's financial data. Provide personalized, actionable recommendations.

Return ONLY valid JSON matching this exact schema (no markdown, no explanation, no code fences):

{
  "recommendations": [
    {
      "id": "string (unique kebab-case identifier, e.g., 'reduce-subscription-overlap')",
      "category": "one of: Immediate Actions, Investment Optimization, Tax Strategies, Debt Optimization, Savings & Retirement, Risk Assessment",
      "title": "string (concise action title, max 60 chars)",
      "description": "string (2-3 sentence explanation with specific numbers from the data)",
      "estimatedImpact": "string or null (e.g., 'Save ~$200/mo', '$1,500 annual tax savings')",
      "priority": "one of: high, medium, low",
      "actionItems": ["string (specific step the user can take)", ...]
    }
  ]
}

RULES:
- Generate 6-10 recommendations based on the data provided
- Use SPECIFIC numbers from the user's actual data in descriptions
- Priority "high" = actionable now with significant impact
- Priority "medium" = important but less urgent
- Priority "low" = worth considering for long-term optimization
- Each recommendation must have 2-4 action items
- Categories must match the enum exactly
- If data is insufficient for a category, skip it — do not fabricate
- Focus on practical, realistic advice grounded in the numbers
- IMPORTANT: Check the DATA COVERAGE section. If there are gaps (missing tax docs, limited months of data, no portfolio info), acknowledge these limitations in your recommendations. One recommendation should always be about uploading missing document types to get better analysis.
- Do NOT assume $0 income or $0 expenses means the user has none — it likely means those documents haven't been uploaded yet`;

export async function generateRecommendations(
  dashboardData: DashboardData
): Promise<Recommendation[]> {
  const financialContext = buildFinancialContext(dashboardData);

  const userPrompt = `Analyze the following financial data and provide personalized recommendations:\n\n${financialContext}\n\nGenerate your recommendations based on this data.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  const parsed = parseJsonResponse(responseText) as {
    recommendations?: unknown[];
  };

  const rawRecs = Array.isArray(parsed.recommendations)
    ? parsed.recommendations
    : Array.isArray(parsed)
    ? parsed
    : [];

  return rawRecs.map(validateRecommendation).filter(Boolean) as Recommendation[];
}

function validateRecommendation(raw: unknown): Recommendation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const VALID_CATEGORIES = [
    "Immediate Actions",
    "Investment Optimization",
    "Tax Strategies",
    "Debt Optimization",
    "Savings & Retirement",
    "Risk Assessment",
  ];

  const VALID_PRIORITIES: Priority[] = ["high", "medium", "low"];

  const category = String(r.category || "");
  const priority = String(r.priority || "medium");

  return {
    id: String(r.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    category: VALID_CATEGORIES.includes(category) ? category : "Immediate Actions",
    title: String(r.title || "Review your finances"),
    description: String(r.description || ""),
    estimatedImpact: r.estimatedImpact ? String(r.estimatedImpact) : null,
    priority: VALID_PRIORITIES.includes(priority as Priority)
      ? (priority as Priority)
      : "medium",
    actionItems: Array.isArray(r.actionItems)
      ? r.actionItems.map(String)
      : [],
  };
}
