import { auth } from "@/lib/auth";
import { getExportData, buildCsvString } from "@/lib/db/export";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const rows = await getExportData(session.user.id);

    if (rows.length === 0) {
      return new Response("No data to export", { status: 404 });
    }

    const csv = buildCsvString(rows);
    const today = new Date().toISOString().split("T")[0];

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="finlens-export-${today}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response("Failed to export data", { status: 500 });
  }
}
