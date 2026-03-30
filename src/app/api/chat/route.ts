import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getChatHistory, clearChatHistory } from "@/lib/db/chat";
import { processChat } from "@/lib/services/chat";

export const maxDuration = 30;

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

// POST — streaming chat response (web client)
// Uses the shared processChat() service, then wraps result in NDJSON stream.
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

    const encoder = new TextEncoder();

    // Run processChat and stream the results as NDJSON
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const result = await processChat(session.user!.id!, message.trim());

          const sendEvent = (event: StreamEvent) => {
            controller.enqueue(
              encoder.encode(JSON.stringify(event) + "\n")
            );
          };

          // Send text
          if (result.text) {
            sendEvent({ type: "text", content: result.text });
          }

          // Send charts
          for (const chart of result.charts) {
            sendEvent({ type: "chart", config: chart });
          }

          // Send memory events
          for (const mem of result.memoryEvents) {
            sendEvent({
              type: "memory",
              action: mem.tool_name,
              detail: mem.detail,
              proposed_fields: mem.proposed_fields,
            });
          }

          controller.close();
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
