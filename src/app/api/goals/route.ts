import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createGoal,
  getGoalsByUser,
  updateGoalCurrentAmount,
} from "@/lib/db/goals";
import { getDashboardData } from "@/lib/db/dashboard";
import type { GoalType, GoalProgress, Goal } from "@/types/financial";

function computeCurrentAmount(
  goal: Goal,
  dashboardData: {
    summary: { netWorth: number; totalAssets: number; totalLiabilities: number };
    portfolioAllocation: { value: number }[];
  }
): number {
  const { summary, portfolioAllocation } = dashboardData;
  const portfolioTotal = portfolioAllocation.reduce(
    (sum, a) => sum + a.value,
    0
  );

  switch (goal.goalType) {
    case "emergency_fund":
      // Liquid assets = total assets minus portfolio (investments are less liquid)
      return Math.max(0, summary.totalAssets - portfolioTotal);
    case "debt_payoff":
      // Current liabilities — progress is measured by reduction
      return summary.totalLiabilities;
    case "savings":
      return summary.totalAssets;
    case "net_worth":
      return summary.netWorth;
    case "retirement":
      return portfolioTotal;
    case "custom":
      // Custom goals keep their last stored value
      return goal.currentAmount;
    default:
      return goal.currentAmount;
  }
}

function computeGoalProgress(
  goal: Goal,
  currentAmount: number
): GoalProgress {
  let percentage: number;
  let remaining: number;

  if (goal.goalType === "debt_payoff") {
    // For debt payoff: target is the initial debt amount, progress = how much paid off
    // Progress = (target - current liabilities) / target * 100
    const paidOff = goal.targetAmount - currentAmount;
    percentage =
      goal.targetAmount > 0 ? (paidOff / goal.targetAmount) * 100 : 0;
    remaining = currentAmount; // remaining debt
  } else {
    percentage =
      goal.targetAmount > 0
        ? (currentAmount / goal.targetAmount) * 100
        : 0;
    remaining = Math.max(0, goal.targetAmount - currentAmount);
  }

  percentage = Math.min(100, Math.max(0, percentage));

  // Check if on track based on deadline
  let isOnTrack = true;
  let projectedCompletionDate: string | null = null;

  if (goal.deadline && goal.createdAt) {
    const created = new Date(goal.createdAt).getTime();
    const deadline = new Date(goal.deadline).getTime();
    const now = Date.now();
    const totalDuration = deadline - created;
    const elapsed = now - created;

    if (totalDuration > 0 && elapsed > 0) {
      const expectedProgress = (elapsed / totalDuration) * 100;
      isOnTrack = percentage >= expectedProgress;

      // Project completion date based on current rate
      if (percentage > 0) {
        const ratePerMs = percentage / elapsed;
        const msToComplete = (100 - percentage) / ratePerMs;
        const projectedDate = new Date(now + msToComplete);
        projectedCompletionDate = projectedDate.toISOString().split("T")[0];
      }
    }
  }

  return {
    goal: { ...goal, currentAmount },
    percentage: Math.round(percentage * 10) / 10,
    remaining,
    isOnTrack,
    projectedCompletionDate,
  };
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [goals, dashboardData] = await Promise.all([
      getGoalsByUser(session.user.id),
      getDashboardData(session.user.id),
    ]);

    // Compute current amounts and update DB
    const progressList: GoalProgress[] = [];

    for (const goal of goals) {
      const currentAmount = computeCurrentAmount(goal, dashboardData);

      // Update stored current_amount as cache
      await updateGoalCurrentAmount(goal.id, session.user.id, currentAmount);

      const progress = computeGoalProgress(goal, currentAmount);
      progressList.push(progress);
    }

    return NextResponse.json({ goals: progressList });
  } catch (error) {
    console.error("Goals list error:", error);
    return NextResponse.json(
      { error: "Failed to load goals" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, goalType, targetAmount, deadline } = body;

    if (!name || !goalType || targetAmount === undefined) {
      return NextResponse.json(
        { error: "Name, goal type, and target amount are required" },
        { status: 400 }
      );
    }

    const validTypes: GoalType[] = [
      "emergency_fund",
      "debt_payoff",
      "savings",
      "net_worth",
      "retirement",
      "custom",
    ];
    if (!validTypes.includes(goalType)) {
      return NextResponse.json(
        { error: "Invalid goal type" },
        { status: 400 }
      );
    }

    if (typeof targetAmount !== "number" || targetAmount <= 0) {
      return NextResponse.json(
        { error: "Target amount must be a positive number" },
        { status: 400 }
      );
    }

    const id = await createGoal({
      userId: session.user.id,
      name,
      goalType,
      targetAmount,
      deadline: deadline || null,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Create goal error:", error);
    return NextResponse.json(
      { error: "Failed to create goal" },
      { status: 500 }
    );
  }
}
