import { sql } from "@/lib/db";
import { decryptNumber } from "./encryption";
import type { ExportRow } from "@/types/financial";

export async function getExportData(userId: string): Promise<ExportRow[]> {
  const result = await sql`
    SELECT
      fd.date,
      fd.data_type,
      fd.category,
      fd.amount,
      fd.description,
      COALESCE(d.file_name, 'Manual Entry') as document_source
    FROM financial_data fd
    LEFT JOIN documents d ON fd.document_id = d.id
    WHERE fd.user_id = ${userId}
    ORDER BY fd.date DESC, fd.data_type, fd.category
  `;

  return result.rows.map((row) => {
    let amount = 0;
    try {
      amount = decryptNumber(row.amount);
    } catch {
      amount = 0;
    }

    return {
      date: row.date ? new Date(row.date).toISOString().split("T")[0] : "",
      type: row.data_type,
      category: row.category,
      amount,
      description: row.description || "",
      documentSource: row.document_source,
    };
  });
}

export function buildCsvString(rows: ExportRow[]): string {
  const headers = ["Date", "Type", "Category", "Amount", "Description", "Document Source"];
  const lines: string[] = [headers.join(",")];

  for (const row of rows) {
    lines.push(
      [
        escapeCsvField(row.date),
        escapeCsvField(row.type),
        escapeCsvField(row.category),
        row.amount.toFixed(2),
        escapeCsvField(row.description),
        escapeCsvField(row.documentSource),
      ].join(",")
    );
  }

  return lines.join("\n");
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
