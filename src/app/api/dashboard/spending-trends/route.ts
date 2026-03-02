import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSpendingTrends } from "@/lib/db/transactions";
import type { DashboardPeriod } from "@/types/financial";

const VALID_PERIODS = new Set<DashboardPeriod>(["3m", "6m", "12m", "all"]);

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period") || "6m";
    const period: DashboardPeriod = VALID_PERIODS.has(
      periodParam as DashboardPeriod
    )
      ? (periodParam as DashboardPeriod)
      : "6m";

    const data = await getSpendingTrends(session.user.id, period);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Spending trends error:", error);
    return NextResponse.json(
      { error: "Failed to load spending trends" },
      { status: 500 }
    );
  }
}
