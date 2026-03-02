import { sql } from "@/lib/db";
import { encryptNumber, encryptJson } from "./encryption";
import type {
  Document,
  DocumentType,
  ProcessingStatus,
  DataType,
  AccountType,
  DataSource,
} from "@/types/financial";

// ─── Document CRUD ───────────────────────────────────────────────

export async function createDocument(params: {
  userId: string;
  documentType: DocumentType;
  fileName: string;
  blobUrl: string;
  fileHash: string;
}): Promise<string> {
  const result = await sql`
    INSERT INTO documents (user_id, document_type, file_name, blob_url, file_hash, processing_status)
    VALUES (${params.userId}, ${params.documentType}, ${params.fileName}, ${params.blobUrl}, ${params.fileHash}, 'pending')
    RETURNING id
  `;
  return result.rows[0].id;
}

export async function getDocumentByHash(
  userId: string,
  fileHash: string
): Promise<Document | null> {
  const result = await sql`
    SELECT id, user_id, document_type, file_name, blob_url, file_hash,
           upload_date, period_start, period_end,
           processing_status, error_message, created_at
    FROM documents
    WHERE user_id = ${userId} AND file_hash = ${fileHash}
    LIMIT 1
  `;
  return (result.rows[0] as Document) ?? null;
}

export async function updateDocumentStatus(
  documentId: string,
  userId: string,
  status: ProcessingStatus,
  errorMessage?: string | null
): Promise<void> {
  if (status === "completed") {
    // Clear blob_url when processing completes (blob has been deleted)
    await sql`
      UPDATE documents
      SET processing_status = ${status},
          error_message = ${errorMessage ?? null},
          blob_url = NULL
      WHERE id = ${documentId} AND user_id = ${userId}
    `;
  } else {
    await sql`
      UPDATE documents
      SET processing_status = ${status},
          error_message = ${errorMessage ?? null}
      WHERE id = ${documentId} AND user_id = ${userId}
    `;
  }
}

export async function updateDocumentPeriod(
  documentId: string,
  userId: string,
  periodStart: string | null,
  periodEnd: string | null
): Promise<void> {
  await sql`
    UPDATE documents
    SET period_start = ${periodStart},
        period_end = ${periodEnd}
    WHERE id = ${documentId} AND user_id = ${userId}
  `;
}

export async function getDocumentsByUser(userId: string): Promise<Document[]> {
  const result = await sql`
    SELECT id, user_id, document_type, file_name, blob_url, file_hash,
           upload_date, period_start, period_end,
           processing_status, error_message, created_at
    FROM documents
    WHERE user_id = ${userId}
    ORDER BY upload_date DESC
  `;
  return result.rows as Document[];
}

export async function getDocumentById(
  documentId: string,
  userId: string
): Promise<Document | null> {
  const result = await sql`
    SELECT id, user_id, document_type, file_name, blob_url, file_hash,
           upload_date, period_start, period_end,
           processing_status, error_message, created_at
    FROM documents
    WHERE id = ${documentId} AND user_id = ${userId}
  `;
  return (result.rows[0] as Document) ?? null;
}

export async function deleteDocument(
  documentId: string,
  userId: string
): Promise<void> {
  // Delete associated financial data first
  await sql`
    DELETE FROM financial_data
    WHERE document_id = ${documentId} AND user_id = ${userId}
  `;
  // Delete the document
  await sql`
    DELETE FROM documents
    WHERE id = ${documentId} AND user_id = ${userId}
  `;
}

// ─── Financial Data ──────────────────────────────────────────────

export async function insertFinancialData(params: {
  documentId: string;
  userId: string;
  dataType: DataType;
  category: string;
  subcategory: string | null;
  amount: number;
  date: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  source: DataSource;
}): Promise<string> {
  const encryptedAmount = encryptNumber(params.amount);
  const encryptedMetadata = params.metadata
    ? encryptJson(params.metadata)
    : null;

  const result = await sql`
    INSERT INTO financial_data (
      document_id, user_id, data_type, category, subcategory,
      amount, date, description, metadata_json, source
    )
    VALUES (
      ${params.documentId}, ${params.userId}, ${params.dataType},
      ${params.category}, ${params.subcategory},
      ${encryptedAmount}, ${params.date}, ${params.description},
      ${encryptedMetadata}, ${params.source}
    )
    RETURNING id
  `;
  return result.rows[0].id;
}

// ─── Accounts ────────────────────────────────────────────────────

export async function findOrCreateAccount(params: {
  userId: string;
  accountName: string;
  accountType: AccountType;
  institution: string | null;
  source: DataSource;
}): Promise<string> {
  // Try to find existing account
  const existing = await sql`
    SELECT id FROM accounts
    WHERE user_id = ${params.userId}
      AND account_name = ${params.accountName}
      AND account_type = ${params.accountType}
  `;

  if (existing.rows.length > 0) {
    // Update last_updated timestamp
    await sql`
      UPDATE accounts SET last_updated = NOW()
      WHERE id = ${existing.rows[0].id}
    `;
    return existing.rows[0].id;
  }

  // Create new account
  const result = await sql`
    INSERT INTO accounts (user_id, account_name, account_type, institution, source, last_updated)
    VALUES (${params.userId}, ${params.accountName}, ${params.accountType},
            ${params.institution}, ${params.source}, NOW())
    RETURNING id
  `;
  return result.rows[0].id;
}

// ─── Portfolio Holdings ──────────────────────────────────────────

export async function upsertPortfolioHolding(params: {
  userId: string;
  accountId: string;
  symbol: string;
  assetClass: string | null;
  quantity: number;
  costBasis: number;
  currentValue: number;
  asOfDate: string;
}): Promise<string> {
  const encryptedCostBasis = encryptNumber(params.costBasis);
  const encryptedCurrentValue = encryptNumber(params.currentValue);

  // Check for existing holding
  const existing = await sql`
    SELECT id FROM portfolio_holdings
    WHERE user_id = ${params.userId}
      AND account_id = ${params.accountId}
      AND symbol = ${params.symbol}
  `;

  if (existing.rows.length > 0) {
    await sql`
      UPDATE portfolio_holdings
      SET asset_class = ${params.assetClass},
          quantity = ${params.quantity},
          cost_basis = ${encryptedCostBasis},
          current_value = ${encryptedCurrentValue},
          as_of_date = ${params.asOfDate}
      WHERE id = ${existing.rows[0].id}
    `;
    return existing.rows[0].id;
  }

  const result = await sql`
    INSERT INTO portfolio_holdings (
      user_id, account_id, symbol, asset_class,
      quantity, cost_basis, current_value, as_of_date
    )
    VALUES (
      ${params.userId}, ${params.accountId}, ${params.symbol},
      ${params.assetClass}, ${params.quantity},
      ${encryptedCostBasis}, ${encryptedCurrentValue}, ${params.asOfDate}
    )
    RETURNING id
  `;
  return result.rows[0].id;
}
