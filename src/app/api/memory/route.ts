import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getClientProfile,
  upsertClientProfile,
  getMemoryNotes,
  updateMemoryNote,
  deleteMemoryNote,
} from "@/lib/db/memory";

// GET — load profile and memory notes
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [profile, notes] = await Promise.all([
      getClientProfile(session.user.id),
      getMemoryNotes(session.user.id, false), // include inactive so user can see all
    ]);

    return NextResponse.json({ profile, notes });
  } catch (error) {
    console.error("Memory GET error:", error);
    return NextResponse.json(
      { error: "Failed to load memory data" },
      { status: 500 }
    );
  }
}

// PUT — update profile or a specific note
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Update profile fields
    if (body.type === "profile") {
      const profile = await upsertClientProfile(session.user.id, body.fields);
      return NextResponse.json({ profile });
    }

    // Update a specific note
    if (body.type === "note" && body.noteId && body.content) {
      const note = await updateMemoryNote(
        body.noteId,
        session.user.id,
        body.content
      );
      if (!note) {
        return NextResponse.json(
          { error: "Note not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ note });
    }

    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Memory PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update memory data" },
      { status: 500 }
    );
  }
}

// DELETE — delete a specific note
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("noteId");

    if (!noteId) {
      return NextResponse.json(
        { error: "noteId is required" },
        { status: 400 }
      );
    }

    const deleted = await deleteMemoryNote(noteId, session.user.id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Memory DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete memory note" },
      { status: 500 }
    );
  }
}
