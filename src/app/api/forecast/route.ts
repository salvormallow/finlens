import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { decryptNumber } from "@/lib/db/encryption";
import {
  generateForecast,
  type ForecastInput,
} from "@/lib/analysis/forecast";
import { generateForecastInsights } from "@/lib/ai/forecast";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const horizon = Math.min(
      Number(request.nextUrl.searchParams.get("horizon") || "30"),
      90
    );

    // Fetch 6 months of income/expense data for pattern detection
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    const startStr = startDate.toISOString().split("T")[0];

    const result = await sql`
      SELECT id, data_type, amount, date
      FROM financial_data
      WHERE user_id = ${session.user.id}
        AND data_type IN ('income', 'expense')
        AND date >= ${startStr}
      ORDER BY date
    `;

    const rows: ForecastInput[] = [];
    for (const r of result.rows) {
      try {
        rows.push({
          id: r.id as string,
          dataType: r.data_type as "income" | "expense",
          amount: decryptNumber(r.amount as string),
          date: r.date as string,
        });
      } catch {
        // Skip decryption failures
      }
    }

    // Compute current balance from latest asset/liability snapshot
    const balanceResult = await sql`
      SELECT data_type, amount
      FROM financial_data
      WHERE user_id = ${session.user.id}
        AND data_type IN ('asset', 'liability')
      ORDER BY date DESC
    `;

    let currentBalance = 0;
    const seenCategories = new Set<string>();
    for (const r of balanceResult.rows) {
      const key = `${r.data_type}-${r.category}`;
      if (seenCategories.has(key)) continue;
      seenCategories.add(key);
      try {
        const amount = decryptNumber(r.amount as string);
        currentBalance +=
          r.data_type === "asset" ? amount : -amount;
      } catch {
        // Skip
      }
    }

    // If no asset data, estimate from recent income/expense patterns
    if (currentBalance === 0 && rows.length > 0) {
      currentBalance = 5000; // Reasonable default
    }

    const forecast = generateForecast(rows, currentBalance, horizon);

    // Generate AI insights (skip if very little data)
    let insights: string | null = null;
    if (rows.length >= 10) {
      try {
        insights = await generateForecastInsights(forecast, horizon);
      } catch (e) {
        console.error("Forecast insights error:", e);
      }
    }

    return NextResponse.json({
      ...forecast,
      insights,
      horizon,
    });
  } catch (error) {
    console.error("Forecast error:", error);
    return NextResponse.json(
      { error: "Failed to generate forecast" },
      { status: 500 }
    );
  }
}
