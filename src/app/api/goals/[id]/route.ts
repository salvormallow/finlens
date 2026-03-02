import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateGoal, deleteGoal } from "@/lib/db/goals";
import type { GoalStatus } from "@/types/financial";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, targetAmount, deadline, status } = body;

    // Validate status if provided
    if (status) {
      const validStatuses: GoalStatus[] = ["active", "completed", "abandoned"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: "Invalid status" },
          { status: 400 }
        );
      }
    }

    await updateGoal({
      goalId: id,
      userId: session.user.id,
      name,
      targetAmount,
      deadline,
      status,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update goal error:", error);
    return NextResponse.json(
      { error: "Failed to update goal" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await deleteGoal(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete goal error:", error);
    return NextResponse.json(
      { error: "Failed to delete goal" },
      { status: 500 }
    );
  }
}
