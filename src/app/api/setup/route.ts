import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { initializeDatabase } from "@/lib/db";

// POST /api/setup - Initialize database and create default user
// Only works if no users exist yet
export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Initialize database tables
    await initializeDatabase();

    // Check if any users exist
    const existingUsers = await sql`SELECT COUNT(*) as count FROM users`;
    if (parseInt(existingUsers.rows[0].count) > 0) {
      return NextResponse.json(
        { error: "Setup already completed. A user already exists." },
        { status: 409 }
      );
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await sql`
      INSERT INTO users (username, password_hash)
      VALUES (${username}, ${passwordHash})
      RETURNING id, username, created_at
    `;

    return NextResponse.json({
      message: "Setup complete",
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
      },
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Setup failed. Check database connection." },
      { status: 500 }
    );
  }
}
