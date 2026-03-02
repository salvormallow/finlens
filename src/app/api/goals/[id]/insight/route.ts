import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGoalById, updateGoalAiInsight } from "@/lib/db/goals";
import { getDashboardData } from "@/lib/db/dashboard";
import { generateGoalInsight } from "@/lib/ai/goals";

export const maxDuration = 30;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const goal = await getGoalById(id, session.user.id);

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const dashboardData = await getDashboardData(session.user.id);
    const insight = await generateGoalInsight(goal, dashboardData);

    await updateGoalAiInsight(id, session.user.id, insight);

    return NextResponse.json({ insight });
  } catch (error) {
    console.error("Goal insight error:", error);
    return NextResponse.json(
      { error: "Failed to generate insight" },
      { status: 500 }
    );
  }
}
