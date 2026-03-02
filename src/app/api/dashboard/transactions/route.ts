import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTransactions } from "@/lib/db/transactions";
import type { DashboardPeriod } from "@/types/financial";

const VALID_PERIODS = new Set<DashboardPeriod>(["3m", "6m", "12m", "all"]);
const VALID_SORTS = new Set(["date", "amount", "category", "dataType"]);
const VALID_ORDERS = new Set(["asc", "desc"]);
const VALID_TYPES = new Set([
  "income",
  "expense",
  "asset",
  "liability",
  "investment",
  "tax",
]);

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10))
    );

    const sortParam = searchParams.get("sort") || "date";
    const sort = VALID_SORTS.has(sortParam) ? sortParam : "date";

    const orderParam = searchParams.get("order") || "desc";
    const order = VALID_ORDERS.has(orderParam)
      ? (orderParam as "asc" | "desc")
      : "desc";

    const periodParam = searchParams.get("period") || "all";
    const period: DashboardPeriod = VALID_PERIODS.has(
      periodParam as DashboardPeriod
    )
      ? (periodParam as DashboardPeriod)
      : "all";

    // Parse type filter
    const typeParam = searchParams.get("type");
    let typeFilter: string[] | undefined;
    if (typeParam) {
      typeFilter = typeParam
        .split(",")
        .filter((t) => VALID_TYPES.has(t.trim()));
      if (typeFilter.length === 0) typeFilter = undefined;
    }

    // Parse category filter
    const categoryFilter = searchParams.get("category") || undefined;

    const { transactions, total } = await getTransactions(session.user.id, {
      page,
      pageSize,
      sort,
      order,
      typeFilter,
      categoryFilter,
      period,
    });

    return NextResponse.json({
      transactions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Transactions error:", error);
    return NextResponse.json(
      { error: "Failed to load transactions" },
      { status: 500 }
    );
  }
}
