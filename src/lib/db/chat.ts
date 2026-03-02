import { sql } from "@/lib/db";
import type { ChatMessage } from "@/types/financial";

// ─── Load chat history ───────────────────────────────────────────

export async function getChatHistory(
  userId: string,
  limit: number = 50
): Promise<ChatMessage[]> {
  const result = await sql`
    SELECT id, user_id, role, content, created_at
    FROM chat_history
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;

  return result.rows.map((r) => ({
    id: r.id as string,
    user_id: r.user_id as string,
    role: r.role as "user" | "assistant",
    content: r.content as string,
    created_at: new Date(r.created_at as string),
  }));
}

// ─── Save a single message ───────────────────────────────────────

export async function saveChatMessage(
  userId: string,
  role: "user" | "assistant",
  content: string
): Promise<string> {
  const result = await sql`
    INSERT INTO chat_history (user_id, role, content)
    VALUES (${userId}, ${role}, ${content})
    RETURNING id
  `;
  return result.rows[0].id as string;
}

// ─── Clear all history for user ──────────────────────────────────

export async function clearChatHistory(userId: string): Promise<void> {
  await sql`
    DELETE FROM chat_history
    WHERE user_id = ${userId}
  `;
}
