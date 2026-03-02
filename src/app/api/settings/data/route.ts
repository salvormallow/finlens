import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteAllUserData } from "@/lib/db/settings";

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await deleteAllUserData(session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete all data error:", error);
    return NextResponse.json(
      { error: "Failed to delete data" },
      { status: 500 }
    );
  }
}
