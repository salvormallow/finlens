import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserDataStats } from "@/lib/db/settings";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = await getUserDataStats(session.user.id);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Settings stats error:", error);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 }
    );
  }
}
