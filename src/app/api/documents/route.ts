import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDocumentsByUser } from "@/lib/db/documents";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const documents = await getDocumentsByUser(session.user.id);
    return NextResponse.json({ documents });
  } catch (error) {
    console.error("List documents error:", error);
    return NextResponse.json(
      { error: "Failed to list documents" },
      { status: 500 }
    );
  }
}
