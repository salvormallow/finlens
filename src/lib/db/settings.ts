import { sql } from "@/lib/db";
import type { UserDataStats } from "@/types/financial";

export async function getUserDataStats(
  userId: string
): Promise<UserDataStats> {
  const [docs, records, accounts] = await Promise.all([
    sql`SELECT COUNT(*)::int as count FROM documents WHERE user_id = ${userId}`,
    sql`SELECT COUNT(*)::int as count FROM financial_data WHERE user_id = ${userId}`,
    sql`SELECT COUNT(*)::int as count FROM accounts WHERE user_id = ${userId}`,
  ]);

  // Goals table may not exist yet if setup hasn't been re-run after Phase 5
  let goalCount = 0;
  try {
    const goals = await sql`SELECT COUNT(*)::int as count FROM goals WHERE user_id = ${userId} AND status = 'active'`;
    goalCount = goals.rows[0].count;
  } catch {
    // Table doesn't exist yet — safe to ignore
  }

  return {
    documentCount: docs.rows[0].count,
    financialRecordCount: records.rows[0].count,
    accountCount: accounts.rows[0].count,
    goalCount,
  };
}

export async function deleteAllUserData(userId: string): Promise<void> {
  // Delete in FK-safe order. Do NOT delete the user row itself.
  await sql`DELETE FROM chat_history WHERE user_id = ${userId}`;
  await sql`DELETE FROM analysis_cache WHERE user_id = ${userId}`;
  await sql`DELETE FROM document_requests WHERE user_id = ${userId}`;
  // Goals table may not exist yet
  try {
    await sql`DELETE FROM goals WHERE user_id = ${userId}`;
  } catch {
    // Table doesn't exist yet — safe to ignore
  }
  await sql`DELETE FROM financial_data WHERE user_id = ${userId}`;
  await sql`DELETE FROM portfolio_holdings WHERE user_id = ${userId}`;
  await sql`DELETE FROM accounts WHERE user_id = ${userId}`;
  await sql`DELETE FROM documents WHERE user_id = ${userId}`;
}
