import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateNarrativeReport, type ReportTone } from "@/lib/ai/reports";
import { createReport, getReports } from "@/lib/db/reports";
import { getDashboardData } from "@/lib/db/dashboard";
import { createHash } from "crypto";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reports = await getReports(session.user.id);
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Get reports error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const tone: ReportTone =
      body.tone === "detailed" ? "detailed" : "concise";

    // Build current financial context
    const dashboardData = await getDashboardData(session.user.id, "all");

    if (!dashboardData.hasData) {
      return NextResponse.json(
        { error: "No financial data available. Upload documents first." },
        { status: 400 }
      );
    }

    // Generate period label
    const now = new Date();
    const periodLabel = now.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    // Simple data hash for dedup
    const dataHash = createHash("sha256")
      .update(
        JSON.stringify({
          netWorth: dashboardData.summary.netWorth,
          income: dashboardData.summary.monthlyIncome,
          expenses: dashboardData.summary.monthlyExpenses,
        })
      )
      .digest("hex")
      .slice(0, 16);

    // Generate report via Claude
    const content = await generateNarrativeReport(dashboardData, {
      tone,
      period: periodLabel,
    });

    // Store in database
    const report = await createReport(
      session.user.id,
      "monthly",
      periodLabel,
      content,
      dataHash,
      tone
    );

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Generate report error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
