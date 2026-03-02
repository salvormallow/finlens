import { sql } from "./index";
import type { ReportTone } from "@/lib/ai/reports";

export interface StoredReport {
  id: string;
  reportType: string;
  periodLabel: string;
  content: string;
  tone: ReportTone;
  createdAt: string;
}

export async function createReport(
  userId: string,
  reportType: string,
  periodLabel: string,
  content: string,
  dataHash: string,
  tone: ReportTone
): Promise<StoredReport> {
  const result = await sql`
    INSERT INTO financial_reports (user_id, report_type, period_label, content, data_hash, tone)
    VALUES (${userId}, ${reportType}, ${periodLabel}, ${content}, ${dataHash}, ${tone})
    RETURNING id, report_type, period_label, content, tone, created_at
  `;

  const row = result.rows[0];
  return {
    id: row.id as string,
    reportType: row.report_type as string,
    periodLabel: row.period_label as string,
    content: row.content as string,
    tone: row.tone as ReportTone,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function getReports(
  userId: string,
  limit = 10
): Promise<StoredReport[]> {
  const result = await sql`
    SELECT id, report_type, period_label, content, tone, created_at
    FROM financial_reports
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return result.rows.map((row) => ({
    id: row.id as string,
    reportType: row.report_type as string,
    periodLabel: row.period_label as string,
    content: row.content as string,
    tone: row.tone as ReportTone,
    createdAt: (row.created_at as Date).toISOString(),
  }));
}
