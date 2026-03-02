import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { decryptNumber } from "@/lib/db/encryption";
import {
  detectRecurringExpenses,
  type DecryptedExpense,
} from "@/lib/analysis/recurring";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch last 12 months of expenses
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);
    startDate.setDate(1);
    const startStr = startDate.toISOString().split("T")[0];

    const result = await sql`
      SELECT id, category, amount, date, description
      FROM financial_data
      WHERE user_id = ${session.user.id}
        AND data_type = 'expense'
        AND date >= ${startStr}
      ORDER BY date
    `;

    // Decrypt and transform
    const expenses: DecryptedExpense[] = [];
    for (const r of result.rows) {
      try {
        expenses.push({
          id: r.id as string,
          category: r.category as string,
          amount: decryptNumber(r.amount as string),
          date: r.date as string,
          description: (r.description as string) || null,
        });
      } catch {
        // Skip decryption failures
      }
    }

    const data = detectRecurringExpenses(expenses);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Recurring expenses error:", error);
    return NextResponse.json(
      { error: "Failed to detect recurring expenses" },
      { status: 500 }
    );
  }
}
