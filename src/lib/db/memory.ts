import { sql } from "@/lib/db";
import type {
  AdvisorClientProfile,
  AdvisorMemoryNote,
  MemoryNoteCategory,
  MemoryNoteSource,
} from "@/types/financial";

// ─── Client Profile ─────────────────────────────────────────────

export async function getClientProfile(
  userId: string
): Promise<AdvisorClientProfile | null> {
  const result = await sql`
    SELECT id, user_id, risk_tolerance, financial_literacy,
           communication_preference, life_stage, household_info,
           key_goals_summary, last_confirmed_at, created_at, updated_at
    FROM advisor_client_profile
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;

  const r = result.rows[0];
  return {
    id: r.id as string,
    userId: r.user_id as string,
    riskTolerance: r.risk_tolerance as AdvisorClientProfile["riskTolerance"],
    financialLiteracy: r.financial_literacy as AdvisorClientProfile["financialLiteracy"],
    communicationPreference: r.communication_preference as AdvisorClientProfile["communicationPreference"],
    lifeStage: r.life_stage as AdvisorClientProfile["lifeStage"],
    householdInfo: r.household_info as Record<string, unknown> | null,
    keyGoalsSummary: r.key_goals_summary as string | null,
    lastConfirmedAt: r.last_confirmed_at ? new Date(r.last_confirmed_at as string).toISOString() : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function upsertClientProfile(
  userId: string,
  fields: Partial<{
    risk_tolerance: string;
    financial_literacy: string;
    communication_preference: string;
    life_stage: string;
    household_info: Record<string, unknown>;
    key_goals_summary: string;
    last_confirmed_at: string;
  }>
): Promise<AdvisorClientProfile> {
  // Upsert: ensure row exists, then update provided fields
  await sql`
    INSERT INTO advisor_client_profile (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
  `;

  // Now update the fields that were provided
  if (fields.risk_tolerance !== undefined) {
    await sql`UPDATE advisor_client_profile SET risk_tolerance = ${fields.risk_tolerance}, updated_at = NOW() WHERE user_id = ${userId}`;
  }
  if (fields.financial_literacy !== undefined) {
    await sql`UPDATE advisor_client_profile SET financial_literacy = ${fields.financial_literacy}, updated_at = NOW() WHERE user_id = ${userId}`;
  }
  if (fields.communication_preference !== undefined) {
    await sql`UPDATE advisor_client_profile SET communication_preference = ${fields.communication_preference}, updated_at = NOW() WHERE user_id = ${userId}`;
  }
  if (fields.life_stage !== undefined) {
    await sql`UPDATE advisor_client_profile SET life_stage = ${fields.life_stage}, updated_at = NOW() WHERE user_id = ${userId}`;
  }
  if (fields.key_goals_summary !== undefined) {
    await sql`UPDATE advisor_client_profile SET key_goals_summary = ${fields.key_goals_summary}, updated_at = NOW() WHERE user_id = ${userId}`;
  }
  if (fields.last_confirmed_at !== undefined) {
    await sql`UPDATE advisor_client_profile SET last_confirmed_at = ${fields.last_confirmed_at}, updated_at = NOW() WHERE user_id = ${userId}`;
  }
  if (fields.household_info !== undefined) {
    const jsonStr = JSON.stringify(fields.household_info);
    await sql`UPDATE advisor_client_profile SET household_info = ${jsonStr}::jsonb, updated_at = NOW() WHERE user_id = ${userId}`;
  }

  const profile = await getClientProfile(userId);
  return profile!;
}

// ─── Memory Notes ────────────────────────────────────────────────

export async function getMemoryNotes(
  userId: string,
  activeOnly: boolean = true
): Promise<AdvisorMemoryNote[]> {
  const result = activeOnly
    ? await sql`
        SELECT id, user_id, category, content, source, source_message_id,
               is_active, created_at, updated_at
        FROM advisor_memory_notes
        WHERE user_id = ${userId} AND is_active = TRUE
        ORDER BY updated_at DESC
      `
    : await sql`
        SELECT id, user_id, category, content, source, source_message_id,
               is_active, created_at, updated_at
        FROM advisor_memory_notes
        WHERE user_id = ${userId}
        ORDER BY updated_at DESC
      `;

  return result.rows.map(mapNoteRow);
}

export async function saveMemoryNote(
  userId: string,
  category: MemoryNoteCategory,
  content: string,
  source: MemoryNoteSource = "chat",
  sourceMessageId?: string
): Promise<AdvisorMemoryNote> {
  const result = await sql`
    INSERT INTO advisor_memory_notes (user_id, category, content, source, source_message_id)
    VALUES (${userId}, ${category}, ${content}, ${source}, ${sourceMessageId ?? null})
    RETURNING id, user_id, category, content, source, source_message_id,
              is_active, created_at, updated_at
  `;

  return mapNoteRow(result.rows[0]);
}

export async function updateMemoryNote(
  noteId: string,
  userId: string,
  content: string
): Promise<AdvisorMemoryNote | null> {
  const result = await sql`
    UPDATE advisor_memory_notes
    SET content = ${content}, updated_at = NOW()
    WHERE id = ${noteId} AND user_id = ${userId}
    RETURNING id, user_id, category, content, source, source_message_id,
              is_active, created_at, updated_at
  `;

  if (result.rows.length === 0) return null;
  return mapNoteRow(result.rows[0]);
}

export async function deactivateMemoryNote(
  noteId: string,
  userId: string
): Promise<boolean> {
  const result = await sql`
    UPDATE advisor_memory_notes
    SET is_active = FALSE, updated_at = NOW()
    WHERE id = ${noteId} AND user_id = ${userId}
    RETURNING id
  `;

  return result.rows.length > 0;
}

export async function deleteMemoryNote(
  noteId: string,
  userId: string
): Promise<boolean> {
  const result = await sql`
    DELETE FROM advisor_memory_notes
    WHERE id = ${noteId} AND user_id = ${userId}
    RETURNING id
  `;

  return result.rows.length > 0;
}

// ─── Helpers ─────────────────────────────────────────────────────

function mapNoteRow(r: Record<string, unknown>): AdvisorMemoryNote {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    category: r.category as MemoryNoteCategory,
    content: r.content as string,
    source: r.source as MemoryNoteSource,
    sourceMessageId: r.source_message_id as string | null,
    isActive: r.is_active as boolean,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}
