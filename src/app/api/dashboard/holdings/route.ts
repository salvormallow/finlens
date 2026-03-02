import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getHoldingsDetail } from "@/lib/db/holdings";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await getHoldingsDetail(session.user.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Holdings error:", error);
    return NextResponse.json(
      { error: "Failed to load holdings" },
      { status: 500 }
    );
  }
}
