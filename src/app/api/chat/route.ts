import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/db/dashboard";
import {
  getChatHistory,
  saveChatMessage,
  clearChatHistory,
} from "@/lib/db/chat";
import { getClientProfile, getMemoryNotes } from "@/lib/db/memory";
import { buildFinancialContext, buildMemoryBrief } from "@/lib/ai/context";
import { CHART_TOOLS, executeChartTool } from "@/lib/ai/chart-tools";
import {
  MEMORY_TOOLS,
  executeMemoryTool,
  type MemoryToolResult,
} from "@/lib/ai/memory-tools";

export const maxDuration = 30;

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
- NEVER memorize: account numbers, SSNs, passwords, exact dollar amounts, or emotional states.
- Bias toward saving more rather than less — it's better to remember something that turns out to be minor than to forget something important.

`;

// Stream event types for NDJSON protocol
interface TextEvent {
  type: "text";
  content: string;
}

interface ChartEvent {
  type: "chart";
  config: unknown;
}

interface MemoryEvent {
  type: "memory";
  action: string;
  detail: string;
  proposed_fields?: Record<string, string>;
}

type StreamEvent = TextEvent | ChartEvent | MemoryEvent;

const ALL_TOOLS = [...CHART_TOOLS, ...MEMORY_TOOLS];
const MEMORY_TOOL_NAMES = new Set(
  MEMORY_TOOLS.map((t) => t.name)
);

// POST — streaming chat response with tool-use support
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const message = body?.message;
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // 1. Save user message to DB
    const userMsgId = await saveChatMessage(
      session.user.id,
      "user",
      message.trim()
    );

    // 2. Load financial context + memory context in parallel
    const [dashboardData, profile, memoryNotes] = await Promise.all([
      getDashboardData(session.user.id),
      getClientProfile(session.user.id),
      getMemoryNotes(session.user.id),
    ]);

    const financialContext = buildFinancialContext(dashboardData);
    const memoryBrief = buildMemoryBrief(profile, memoryNotes);
    const systemPrompt =
      SYSTEM_PROMPT_PREFIX +
      financialContext +
      "\n\n" +
      memoryBrief;

    // 3. Load chat history
    const history = await getChatHistory(session.user.id, 20);
    const messages: Anthropic.Messages.MessageParam[] = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const userId = session.user.id;
    const encoder = new TextEncoder();

    // 4. Create NDJSON stream
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let fullTextResponse = "";

          const sendEvent = (event: StreamEvent) => {
            controller.enqueue(
              encoder.encode(JSON.stringify(event) + "\n")
            );
          };

          // Agentic loop: keep calling Claude until no more tool_use blocks
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

            // Collect tool results for this turn
            const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
            let hasToolUse = false;

            for (const block of response.content) {
              if (block.type === "text" && block.text) {
                sendEvent({ type: "text", content: block.text });
                fullTextResponse += block.text;
              } else if (block.type === "tool_use") {
                hasToolUse = true;

                if (MEMORY_TOOL_NAMES.has(block.name)) {
                  // Execute memory tool
                  const result: MemoryToolResult = await executeMemoryTool(
                    block.name,
                    block.input,
                    userId,
                    userMsgId
                  );

                  sendEvent({
                    type: "memory",
                    action: block.name,
                    detail: result.detail,
                    proposed_fields: result.proposed_fields,
                  });

                  toolResults.push({
                    type: "tool_result",
                    tool_use_id: block.id,
                    content: JSON.stringify(result),
                  });
                } else if (block.name === "generate_chart") {
                  // Execute chart tool
                  try {
                    const chartConfig = await executeChartTool(
                      block.input as Parameters<typeof executeChartTool>[0],
                      userId
                    );
                    sendEvent({ type: "chart", config: chartConfig });

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
                        error:
                          "Chart generation failed — possibly insufficient data.",
                      }),
                      is_error: true,
                    });
                  }
                }
              }
            }

            if (hasToolUse && toolResults.length > 0) {
              // Append assistant response + tool results, then loop
              currentMessages = [
                ...currentMessages,
                { role: "assistant", content: response.content },
                { role: "user", content: toolResults },
              ];
            } else {
              // No tool use — we're done
              continueLoop = false;
            }

            // Safety: stop after a reasonable number of iterations
            if (currentMessages.length > messages.length + 10) {
              continueLoop = false;
            }
          }

          controller.close();

          // Persist assistant response
          if (fullTextResponse.trim()) {
            await saveChatMessage(
              userId,
              "assistant",
              fullTextResponse.trim()
            );
          }
        } catch (error) {
          console.error("Chat stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}

// GET — load chat history
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const history = await getChatHistory(session.user.id, 50);
    return NextResponse.json({ messages: history });
  } catch (error) {
    console.error("Chat history error:", error);
    return NextResponse.json(
      { error: "Failed to load chat history" },
      { status: 500 }
    );
  }
}

// DELETE — clear chat history
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await clearChatHistory(session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clear chat error:", error);
    return NextResponse.json(
      { error: "Failed to clear chat history" },
      { status: 500 }
    );
  }
}
