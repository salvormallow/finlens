import { createHash } from "crypto";
import { sql } from "@/lib/db";
import type { DashboardData, AnalysisType, Recommendation } from "@/types/financial";

// ─── Hash computation ────────────────────────────────────────────

export function computeDataHash(data: DashboardData): string {
  const hashInput = JSON.stringify({
    summary: data.summary,
    portfolioAllocation: data.portfolioAllocation,
    cashFlow: data.cashFlow,
    taxOverview: data.taxOverview,
    monthlyPnL: data.monthlyPnL,
  });
  return createHash("sha256").update(hashInput).digest("hex");
}

// ─── Cache read ──────────────────────────────────────────────────

export async function getCachedAnalysis(
  userId: string,
  analysisType: AnalysisType,
  currentHash: string
): Promise<Recommendation[] | null> {
  const result = await sql`
    SELECT result_json
    FROM analysis_cache
    WHERE user_id = ${userId}
      AND analysis_type = ${analysisType}
      AND data_hash = ${currentHash}
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;

  try {
    return JSON.parse(result.rows[0].result_json as string) as Recommendation[];
  } catch {
    return null;
  }
}

// ─── Cache write ─────────────────────────────────────────────────

export async function setCachedAnalysis(
  userId: string,
  analysisType: AnalysisType,
  dataHash: string,
  result: Recommendation[]
): Promise<void> {
  const resultJson = JSON.stringify(result);

  // Delete any existing cache for this user + analysis type
  await sql`
    DELETE FROM analysis_cache
    WHERE user_id = ${userId}
      AND analysis_type = ${analysisType}
  `;

  // Insert new cache entry with 24h TTL
  await sql`
    INSERT INTO analysis_cache (user_id, analysis_type, data_hash, result_json, expires_at)
    VALUES (
      ${userId},
      ${analysisType},
      ${dataHash},
      ${resultJson},
      NOW() + INTERVAL '24 hours'
    )
  `;
}
