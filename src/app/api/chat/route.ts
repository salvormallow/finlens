import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/db/dashboard";
import {
  getChatHistory,
  saveChatMessage,
  clearChatHistory,
} from "@/lib/db/chat";
import { buildFinancialContext } from "@/lib/ai/context";
import { CHART_TOOLS, executeChartTool } from "@/lib/ai/chart-tools";

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

--- USER'S UPLOADED FINANCIAL DATA (may be incomplete) ---
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

type StreamEvent = TextEvent | ChartEvent;

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
    await saveChatMessage(session.user.id, "user", message.trim());

    // 2. Load financial context
    const dashboardData = await getDashboardData(session.user.id);
    const financialContext = buildFinancialContext(dashboardData);
    const systemPrompt = SYSTEM_PROMPT_PREFIX + financialContext;

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

          // First API call (may include tool_use)
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2048,
            temperature: 0.7,
            system: systemPrompt,
            messages,
            tools: CHART_TOOLS,
          });

          // Process content blocks
          for (const block of response.content) {
            if (block.type === "text" && block.text) {
              sendEvent({ type: "text", content: block.text });
              fullTextResponse += block.text;
            } else if (block.type === "tool_use") {
              // Execute the chart tool
              try {
                const chartConfig = await executeChartTool(
                  block.input as Parameters<typeof executeChartTool>[0],
                  userId
                );
                sendEvent({ type: "chart", config: chartConfig });

                // Now get Claude's follow-up response after tool result
                const followUp = await anthropic.messages.create({
                  model: "claude-sonnet-4-20250514",
                  max_tokens: 1024,
                  temperature: 0.7,
                  system: systemPrompt,
                  messages: [
                    ...messages,
                    { role: "assistant", content: response.content },
                    {
                      role: "user",
                      content: [
                        {
                          type: "tool_result",
                          tool_use_id: block.id,
                          content: JSON.stringify({
                            success: true,
                            chartType: chartConfig.chartType,
                            dataPoints: chartConfig.data.length,
                            series: chartConfig.series.map((s) => s.label),
                          }),
                        },
                      ],
                    },
                  ],
                  tools: CHART_TOOLS,
                });

                // Extract text from follow-up
                for (const fb of followUp.content) {
                  if (fb.type === "text" && fb.text) {
                    sendEvent({ type: "text", content: fb.text });
                    fullTextResponse += fb.text;
                  }
                }
              } catch (toolError) {
                console.error("Chart tool error:", toolError);
                const errorMsg =
                  "\n\nI tried to generate a chart but encountered an error. This may be due to insufficient data — try uploading more financial documents.";
                sendEvent({ type: "text", content: errorMsg });
                fullTextResponse += errorMsg;
              }
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
