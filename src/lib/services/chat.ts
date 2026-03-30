/**
 * Chat Service — core chat logic extracted from /api/chat route.
 *
 * Both the web streaming route and the Telegram handler call this.
 * The web route wraps the result in NDJSON streaming;
 * the Telegram handler sends discrete messages.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getDashboardData } from "@/lib/db/dashboard";
import { getChatHistory, saveChatMessage } from "@/lib/db/chat";
import { getClientProfile, getMemoryNotes } from "@/lib/db/memory";
import { buildFinancialContext, buildMemoryBrief } from "@/lib/ai/context";
import { CHART_TOOLS, executeChartTool } from "@/lib/ai/chart-tools";
import type { ChartConfig } from "@/lib/ai/chart-tools";
import {
  MEMORY_TOOLS,
  executeMemoryTool,
  type MemoryToolResult,
} from "@/lib/ai/memory-tools";

const anthropic = new Anthropic();

const SYSTEM_PROMPT_PREFIX = `You are FinLens AI, a knowledgeable financial assistant. You have access to ONLY the financial data the user has uploaded so far, summarized below. This data may be incomplete.

CRITICAL — DATA COMPLETENESS:
- You can ONLY see data from documents the user has uploaded. You do NOT have their full financial picture.
- Before giving major financial advice (buying a house, retirement planning, investment changes), ALWAYS acknowledge what data you're missing and ask the user if they've uploaded all relevant documents.
- Look at the data coverage below: if there are only a few months of data, no tax documents, no portfolio data, or $0 income/expenses for the current month, explicitly note these gaps.
- Never present conclusions as definitive when working from partial data. Use hedging language: "Based on what I can see...", "From the data uploaded so far...", "This picture may change once you upload more documents..."
- If income or expenses show $0 for recent months, that likely means no recent documents have been uploaded — NOT that the user has zero income.

GUIDELINES:
- Answer questions using the data provided, but always frame answers within the context of data completeness
- Be conversational but precise — cite specific numbers from their data
- For projections and what-if scenarios, show your math briefly and note what assumptions you're making due to data gaps
- If the user asks about something not covered by the data, say so honestly and suggest which documents to upload
- Keep responses concise (2-4 paragraphs typical, more for complex analyses)
- Use plain language, avoid excessive jargon
- Format numbers as currency where appropriate ($1,234.56)
- When giving specific financial advice, include a brief note that you're an AI assistant and not a licensed financial advisor

CHART GENERATION:
- When the user asks to "show", "chart", "graph", "visualize", "compare", or "plot" data, use the generate_chart tool.
- Pick the best chart_type: bar for comparisons, line/area for trends over time, pie for proportions, stacked_bar for composition over time.
- After generating a chart, provide a brief 1-2 sentence insight about what the chart shows.

CLIENT MEMORY:
- You have memory tools to remember important facts about this client across sessions.
- When the client reveals something worth remembering (life events, financial plans, corrections, preferences, follow-ups), use the save_memory tool.
- Before saving, check the Client Memory Brief below to avoid duplicates. If a fact already exists but has changed, use update_memory instead.
- When you save a memory, briefly mention it naturally in your response, e.g., "I've noted that you're planning to buy a house in 2027."
- For profile-level insights (risk tolerance, life stage, etc.), use propose_profile_update when you're confident.
- NEVER memorize: account numbers, SSNs, passwords, exact dollar amounts (those are in the financial data), or emotional states.
- Bias toward saving more rather than less — it's better to remember something that turns out to be minor than to forget something important.

`;

const ALL_TOOLS = [...CHART_TOOLS, ...MEMORY_TOOLS];
const MEMORY_TOOL_NAMES = new Set(MEMORY_TOOLS.map((t) => t.name));

// ─── Result types ───────────────────────────────────────────────

export interface ChatResult {
  text: string;
  charts: ChartConfig[];
  memoryEvents: MemoryToolResult[];
}

// ─── Main service function ──────────────────────────────────────

/**
 * Process a chat message for the given user. Returns the complete response
 * (text + charts + memory events) without streaming.
 *
 * Called by both the web API route (which wraps it in NDJSON streaming)
 * and the Telegram handler (which sends discrete messages).
 */
export async function processChat(
  userId: string,
  message: string
): Promise<ChatResult> {
  // 1. Save user message to DB
  const userMsgId = await saveChatMessage(userId, "user", message);

  // 2. Load financial context + memory context in parallel
  const [dashboardData, profile, memoryNotes] = await Promise.all([
    getDashboardData(userId),
    getClientProfile(userId),
    getMemoryNotes(userId),
  ]);

  const financialContext = buildFinancialContext(dashboardData);
  const memoryBrief = buildMemoryBrief(profile, memoryNotes);
  const systemPrompt = SYSTEM_PROMPT_PREFIX + financialContext + "\n\n" + memoryBrief;

  // 3. Load chat history
  const history = await getChatHistory(userId, 20);
  const messages: Anthropic.Messages.MessageParam[] = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // 4. Run agentic tool-use loop
  let fullText = "";
  const charts: ChartConfig[] = [];
  const memoryEvents: MemoryToolResult[] = [];

  let currentMessages = [...messages];
  let continueLoop = true;

  while (continueLoop) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      temperature: 0.7,
      system: systemPrompt,
      messages: currentMessages,
      tools: ALL_TOOLS,
    });

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    let hasToolUse = false;

    for (const block of response.content) {
      if (block.type === "text" && block.text) {
        fullText += block.text;
      } else if (block.type === "tool_use") {
        hasToolUse = true;

        if (MEMORY_TOOL_NAMES.has(block.name)) {
          const result: MemoryToolResult = await executeMemoryTool(
            block.name,
            block.input,
            userId,
            userMsgId
          );
          memoryEvents.push(result);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } else if (block.name === "generate_chart") {
          try {
            const chartConfig = await executeChartTool(
              block.input as Parameters<typeof executeChartTool>[0],
              userId
            );
            charts.push(chartConfig);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify({
                success: true,
                chartType: chartConfig.chartType,
                dataPoints: chartConfig.data.length,
                series: chartConfig.series.map((s) => s.label),
              }),
            });
          } catch (toolError) {
            console.error("Chart tool error:", toolError);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify({
                success: false,
                error: "Chart generation failed — possibly insufficient data.",
              }),
              is_error: true,
            });
          }
        }
      }
    }

    if (hasToolUse && toolResults.length > 0) {
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
    } else {
      continueLoop = false;
    }

    // Safety: stop after a reasonable number of iterations
    if (currentMessages.length > messages.length + 10) {
      continueLoop = false;
    }
  }

  // 5. Persist assistant response
  if (fullText.trim()) {
    await saveChatMessage(userId, "assistant", fullText.trim());
  }

  return { text: fullText, charts, memoryEvents };
}
