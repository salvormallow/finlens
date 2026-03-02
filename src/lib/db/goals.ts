import { sql } from "@/lib/db";
import { encryptNumber, decryptNumber } from "./encryption";
import type { Goal, GoalType, GoalStatus } from "@/types/financial";

export async function createGoal(params: {
  userId: string;
  name: string;
  goalType: GoalType;
  targetAmount: number;
  deadline: string | null;
}): Promise<string> {
  const encryptedTarget = encryptNumber(params.targetAmount);
  const result = await sql`
    INSERT INTO goals (user_id, name, goal_type, target_amount, deadline)
    VALUES (
      ${params.userId},
      ${params.name},
      ${params.goalType},
      ${encryptedTarget},
      ${params.deadline}
    )
    RETURNING id
  `;
  return result.rows[0].id;
}

export async function getGoalsByUser(userId: string): Promise<Goal[]> {
  const result = await sql`
    SELECT id, user_id, name, goal_type, target_amount, current_amount,
           deadline, status, ai_insight, ai_insight_updated_at,
           created_at, updated_at
    FROM goals
    WHERE user_id = ${userId}
      AND status IN ('active', 'completed')
    ORDER BY created_at DESC
  `;

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    goalType: row.goal_type as GoalType,
    targetAmount: decryptNumber(row.target_amount),
    currentAmount: row.current_amount ? decryptNumber(row.current_amount) : 0,
    deadline: row.deadline ? row.deadline.toISOString().split("T")[0] : null,
    status: row.status as GoalStatus,
    aiInsight: row.ai_insight,
    aiInsightUpdatedAt: row.ai_insight_updated_at
      ? row.ai_insight_updated_at.toISOString()
      : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
}

export async function getGoalById(
  goalId: string,
  userId: string
): Promise<Goal | null> {
  const result = await sql`
    SELECT id, user_id, name, goal_type, target_amount, current_amount,
           deadline, status, ai_insight, ai_insight_updated_at,
           created_at, updated_at
    FROM goals
    WHERE id = ${goalId} AND user_id = ${userId}
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    goalType: row.goal_type as GoalType,
    targetAmount: decryptNumber(row.target_amount),
    currentAmount: row.current_amount ? decryptNumber(row.current_amount) : 0,
    deadline: row.deadline ? row.deadline.toISOString().split("T")[0] : null,
    status: row.status as GoalStatus,
    aiInsight: row.ai_insight,
    aiInsightUpdatedAt: row.ai_insight_updated_at
      ? row.ai_insight_updated_at.toISOString()
      : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function updateGoal(params: {
  goalId: string;
  userId: string;
  name?: string;
  targetAmount?: number;
  deadline?: string | null;
  status?: GoalStatus;
}): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (params.name !== undefined) {
    sets.push("name");
    values.push(params.name);
  }
  if (params.targetAmount !== undefined) {
    sets.push("target_amount");
    values.push(encryptNumber(params.targetAmount));
  }
  if (params.deadline !== undefined) {
    sets.push("deadline");
    values.push(params.deadline);
  }
  if (params.status !== undefined) {
    sets.push("status");
    values.push(params.status);
  }

  if (sets.length === 0) return;

  // Build dynamic update using individual queries for each field
  // since @vercel/postgres doesn't support dynamic column names easily
  for (let i = 0; i < sets.length; i++) {
    const col = sets[i];
    const val = values[i];
    if (col === "name") {
      await sql`UPDATE goals SET name = ${val as string}, updated_at = NOW() WHERE id = ${params.goalId} AND user_id = ${params.userId}`;
    } else if (col === "target_amount") {
      await sql`UPDATE goals SET target_amount = ${val as string}, updated_at = NOW() WHERE id = ${params.goalId} AND user_id = ${params.userId}`;
    } else if (col === "deadline") {
      await sql`UPDATE goals SET deadline = ${val as string | null}, updated_at = NOW() WHERE id = ${params.goalId} AND user_id = ${params.userId}`;
    } else if (col === "status") {
      await sql`UPDATE goals SET status = ${val as string}, updated_at = NOW() WHERE id = ${params.goalId} AND user_id = ${params.userId}`;
    }
  }
}

export async function updateGoalCurrentAmount(
  goalId: string,
  userId: string,
  currentAmount: number
): Promise<void> {
  const encrypted = encryptNumber(currentAmount);
  await sql`
    UPDATE goals
    SET current_amount = ${encrypted}, updated_at = NOW()
    WHERE id = ${goalId} AND user_id = ${userId}
  `;
}

export async function updateGoalAiInsight(
  goalId: string,
  userId: string,
  insight: string
): Promise<void> {
  await sql`
    UPDATE goals
    SET ai_insight = ${insight}, ai_insight_updated_at = NOW(), updated_at = NOW()
    WHERE id = ${goalId} AND user_id = ${userId}
  `;
}

export async function deleteGoal(
  goalId: string,
  userId: string
): Promise<void> {
  await sql`
    DELETE FROM goals
    WHERE id = ${goalId} AND user_id = ${userId}
  `;
}
