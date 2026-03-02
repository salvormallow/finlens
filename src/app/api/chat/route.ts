import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/db/dashboard";
import { getChatHistory, saveChatMessage, clearChatHistory } from "@/lib/db/chat";
import { buildFinancialContext } from "@/lib/ai/context";

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

--- USER'S UPLOADED FINANCIAL DATA (may be incomplete) ---
`;

// POST — streaming chat response
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

    // 3. Load chat history (last 20 messages for context window)
    const history = await getChatHistory(session.user.id, 20);
    const messages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // 4. Stream response from Claude
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      temperature: 0.7,
      system: systemPrompt,
      messages,
    });

    // 5. Convert SDK stream to ReadableStream, collecting full text for DB persistence
    const encoder = new TextEncoder();
    let fullResponse = "";

    const userId = session.user.id;
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text;
              fullResponse += text;
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();

          // Persist assistant response after stream completes
          if (fullResponse.trim()) {
            await saveChatMessage(userId, "assistant", fullResponse.trim());
          }
        } catch (error) {
          console.error("Chat stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
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
