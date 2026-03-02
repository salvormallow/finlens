import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/db/dashboard";
import {
  computeDataHash,
  getCachedAnalysis,
  setCachedAnalysis,
} from "@/lib/db/cache";
import { generateRecommendations } from "@/lib/ai/recommendations";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    // 1. Get user's financial data
    const dashboardData = await getDashboardData(session.user.id);
    if (!dashboardData.hasData) {
      return NextResponse.json({ recommendations: [], noData: true });
    }

    // 2. Check cache (unless force refresh)
    const dataHash = computeDataHash(dashboardData);
    if (!forceRefresh) {
      const cached = await getCachedAnalysis(
        session.user.id,
        "recommendations",
        dataHash
      );
      if (cached) {
        return NextResponse.json({ recommendations: cached, cached: true });
      }
    }

    // 3. Generate via Claude
    const recommendations = await generateRecommendations(dashboardData);

    // 4. Cache the result
    await setCachedAnalysis(
      session.user.id,
      "recommendations",
      dataHash,
      recommendations
    );

    return NextResponse.json({ recommendations, cached: false });
  } catch (error) {
    console.error("Recommendations error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
