/**
 * Document Service — core document ingestion logic extracted from API routes.
 *
 * Supports two ingestion paths:
 * 1. Web upload: FormData with file + explicit documentType (existing flow)
 * 2. Telegram/auto: Raw file buffer with auto-classification via Claude
 *
 * Both paths converge on processDocument() for extraction and storage.
 */

import { put, del } from "@vercel/blob";
import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { extractTextFromFile } from "@/lib/documents/parse";
import { extractFinancialData } from "@/lib/ai/extract";
import type { ExtractedFinancialData } from "@/lib/ai/extract";
import {
  createDocument,
  getDocumentByHash,
  updateDocumentStatus,
  updateDocumentPeriod,
  insertFinancialData,
  findOrCreateAccount,
  upsertPortfolioHolding,
} from "@/lib/db/documents";
import type { DocumentType } from "@/types/financial";

const anthropic = new Anthropic();

// ─── Result types ───────────────────────────────────────────────

export interface UploadResult {
  documentId: string;
  fileName: string;
  duplicate: boolean;
}

export interface ProcessResult {
  status: "completed" | "failed";
  documentType: DocumentType;
  transactionsCount: number;
  accountsCount: number;
  holdingsCount: number;
  error?: string;
}

export interface IngestResult {
  upload: UploadResult;
  processing: ProcessResult;
  extracted: ExtractedFinancialData;
}

// ─── Constants ──────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const TEXT_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/csv",
]);

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const VALID_DOC_TYPES: DocumentType[] = [
  "bank_statement",
  "w2",
  "tax_return",
  "portfolio_statement",
  "credit_card_statement",
  "pay_stub",
  "1099",
  "other",
];

// ─── Upload ─────────────────────────────────────────────────────

/**
 * Upload a file to blob storage and create a document record.
 * Does NOT process the document — call processDocument() after.
 */
export async function uploadDocument(params: {
  userId: string;
  file: {
    name: string;
    type: string;
    buffer: Buffer;
  };
  documentType: DocumentType;
}): Promise<UploadResult> {
  const { userId, file, documentType } = params;

  if (file.buffer.length > MAX_FILE_SIZE) {
    throw new Error("File too large (max 10MB)");
  }

  if (!VALID_DOC_TYPES.includes(documentType)) {
    throw new Error(`Invalid document type: ${documentType}`);
  }

  // Compute hash for dedup
  const fileHash = createHash("sha256").update(file.buffer).digest("hex");
  const existing = await getDocumentByHash(userId, fileHash);
  if (existing) {
    return { documentId: existing.id, fileName: existing.file_name, duplicate: true };
  }

  // Upload to Vercel Blob
  const blob = await put(
    `staging/${userId}/${Date.now()}-${file.name}`,
    new Blob([file.buffer], { type: file.type }),
    { access: "private" }
  );

  const documentId = await createDocument({
    userId,
    documentType,
    fileName: file.name,
    blobUrl: blob.url,
    fileHash,
  });

  return { documentId, fileName: file.name, duplicate: false };
}

// ─── Process ────────────────────────────────────────────────────

/**
 * Process a previously uploaded document: extract text, send to Claude,
 * store financial data.
 */
export async function processDocument(
  documentId: string,
  userId: string,
  blobUrl: string,
  documentType: DocumentType
): Promise<{ result: ProcessResult; extracted: ExtractedFinancialData }> {
  await updateDocumentStatus(documentId, userId, "processing");

  try {
    // 1. Download from blob
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    const response = await fetch(blobUrl, {
      headers: blobToken ? { Authorization: `Bearer ${blobToken}` } : {},
    });
    if (!response.ok) {
      throw new Error("Failed to download file from blob storage");
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type") || "application/pdf";

    // 2. Extract text
    const text = await extractTextFromFile(buffer, mimeType);
    if (!text.trim()) {
      throw new Error("No text could be extracted from the document.");
    }

    // 3. Claude extraction
    const extracted = await extractFinancialData(text, documentType);

    // 4. Store results
    await storeExtractedData(documentId, userId, extracted);

    // 5. Cleanup blob
    try {
      await del(blobUrl);
    } catch (e) {
      console.warn("Failed to delete blob (non-fatal):", e);
    }

    // 6. Mark completed
    await updateDocumentStatus(documentId, userId, "completed");

    return {
      result: {
        status: "completed",
        documentType: extracted.documentType,
        transactionsCount: extracted.transactions.length,
        accountsCount: extracted.accounts.length,
        holdingsCount: extracted.holdings.length,
      },
      extracted,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown processing error";
    await updateDocumentStatus(documentId, userId, "failed", errorMessage);
    return {
      result: {
        status: "failed",
        documentType,
        transactionsCount: 0,
        accountsCount: 0,
        holdingsCount: 0,
        error: errorMessage,
      },
      extracted: {
        documentType,
        periodStart: null,
        periodEnd: null,
        accounts: [],
        transactions: [],
        holdings: [],
      },
    };
  }
}

// ─── Ingest (upload + auto-classify + process) ──────────────────

/**
 * Full ingestion pipeline for Telegram and other non-web channels.
 * Accepts any supported file type, auto-detects document type via Claude,
 * and processes in one shot.
 */
export async function ingestDocument(params: {
  userId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<IngestResult> {
  const { userId, fileName, mimeType, buffer } = params;

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("File too large (max 10MB)");
  }

  // Compute hash for dedup
  const fileHash = createHash("sha256").update(buffer).digest("hex");
  const existing = await getDocumentByHash(userId, fileHash);
  if (existing) {
    throw new Error(`This file has already been uploaded as "${existing.file_name}"`);
  }

  let extracted: ExtractedFinancialData;

  if (IMAGE_MIME_TYPES.has(mimeType)) {
    // Image path: use Claude vision for extraction + classification
    extracted = await extractFromImage(buffer, mimeType);
  } else if (TEXT_MIME_TYPES.has(mimeType) || fileName.endsWith(".pdf")) {
    // Text/PDF path: extract text, then send to Claude
    const text = await extractTextFromFile(buffer, mimeType);
    if (!text.trim()) {
      throw new Error("No text could be extracted from the document.");
    }
    extracted = await extractFinancialData(text);
  } else {
    // Try PDF as fallback
    try {
      const text = await extractTextFromFile(buffer, "application/pdf");
      if (!text.trim()) throw new Error("empty");
      extracted = await extractFinancialData(text);
    } catch {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  }

  // Upload to blob
  const blob = await put(
    `staging/${userId}/${Date.now()}-${fileName}`,
    new Blob([buffer], { type: mimeType }),
    { access: "private" }
  );

  // Create document record with auto-detected type
  const documentId = await createDocument({
    userId,
    documentType: extracted.documentType,
    fileName,
    blobUrl: blob.url,
    fileHash,
  });

  // Store extracted data
  await updateDocumentStatus(documentId, userId, "processing");
  await storeExtractedData(documentId, userId, extracted);

  // Cleanup blob
  try {
    await del(blob.url);
  } catch (e) {
    console.warn("Failed to delete blob (non-fatal):", e);
  }

  await updateDocumentStatus(documentId, userId, "completed");

  return {
    upload: { documentId, fileName, duplicate: false },
    processing: {
      status: "completed",
      documentType: extracted.documentType,
      transactionsCount: extracted.transactions.length,
      accountsCount: extracted.accounts.length,
      holdingsCount: extracted.holdings.length,
    },
    extracted,
  };
}

// ─── Image extraction via Claude Vision ─────────────────────────

async function extractFromImage(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedFinancialData> {
  const base64 = buffer.toString("base64");
  const mediaType = mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16384,
    temperature: 0,
    system: VISION_EXTRACTION_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: "Extract all financial data from this document image. Auto-detect the document type. Return structured JSON.",
          },
        ],
      },
    ],
  });

  const responseText =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Reuse the existing JSON parser from extract.ts
  const { parseJsonResponse } = await import("@/lib/ai/extract");
  const parsed = parseJsonResponse(responseText);
  return validateExtractedData(parsed);
}

const VISION_EXTRACTION_PROMPT = `You are a financial document parser with vision capabilities. Extract structured financial data from the document image provided.

The image may be a photo of a paper statement, a screenshot of a banking app, or a scanned financial document.

Return ONLY valid JSON matching this exact schema (no markdown, no explanation, no code fences):

{
  "documentType": one of ["bank_statement", "w2", "tax_return", "portfolio_statement", "credit_card_statement", "pay_stub", "1099", "other"],
  "periodStart": "YYYY-MM-DD" or null,
  "periodEnd": "YYYY-MM-DD" or null,
  "accounts": [
    {
      "accountName": "string",
      "accountType": one of ["checking", "savings", "brokerage", "credit_card", "retirement", "other"],
      "institution": "string or null"
    }
  ],
  "transactions": [
    {
      "dataType": one of ["income", "expense", "asset", "liability", "investment", "tax"],
      "category": "string",
      "subcategory": "string or null",
      "amount": positive number,
      "date": "YYYY-MM-DD",
      "description": "string or null",
      "metadata": object or null
    }
  ],
  "holdings": [
    {
      "accountName": "string",
      "symbol": "string",
      "assetClass": "string or null",
      "quantity": number,
      "costBasis": number,
      "currentValue": number,
      "asOfDate": "YYYY-MM-DD"
    }
  ]
}

IMPORTANT:
- Auto-detect the document type from the image content
- Always use POSITIVE amounts. The dataType field distinguishes direction.
- Use empty arrays [] for missing sections
- If text is partially obscured, extract what you can and note gaps in metadata`;

// ─── Shared helpers ─────────────────────────────────────────────

async function storeExtractedData(
  documentId: string,
  userId: string,
  extracted: ExtractedFinancialData
): Promise<void> {
  // Update document period
  await updateDocumentPeriod(
    documentId,
    userId,
    extracted.periodStart,
    extracted.periodEnd
  );

  // Create/find accounts
  const accountIdMap = new Map<string, string>();
  for (const account of extracted.accounts) {
    const accountId = await findOrCreateAccount({
      userId,
      accountName: account.accountName,
      accountType: account.accountType,
      institution: account.institution,
      source: "manual_upload",
    });
    accountIdMap.set(account.accountName, accountId);
  }

  // Insert financial data (transactions)
  for (const txn of extracted.transactions) {
    await insertFinancialData({
      documentId,
      userId,
      dataType: txn.dataType,
      category: txn.category,
      subcategory: txn.subcategory,
      amount: txn.amount,
      date: txn.date,
      description: txn.description,
      metadata: txn.metadata,
      source: "manual_upload",
    });
  }

  // Insert portfolio holdings
  for (const holding of extracted.holdings) {
    const accountId = accountIdMap.get(holding.accountName);
    if (!accountId) continue;
    await upsertPortfolioHolding({
      userId,
      accountId,
      symbol: holding.symbol,
      assetClass: holding.assetClass,
      quantity: holding.quantity,
      costBasis: holding.costBasis,
      currentValue: holding.currentValue,
      asOfDate: holding.asOfDate,
    });
  }
}

function validateExtractedData(data: unknown): ExtractedFinancialData {
  if (!data || typeof data !== "object") {
    throw new Error("Claude response is not an object");
  }

  const d = data as Record<string, unknown>;

  return {
    documentType: (d.documentType as DocumentType) || "other",
    periodStart: (d.periodStart as string) || null,
    periodEnd: (d.periodEnd as string) || null,
    accounts: Array.isArray(d.accounts)
      ? d.accounts.map((a: Record<string, unknown>) => ({
          accountName: String(a.accountName || "Unknown Account"),
          accountType: (a.accountType as ExtractedFinancialData["accounts"][0]["accountType"]) || "other",
          institution: (a.institution as string) || null,
        }))
      : [],
    transactions: Array.isArray(d.transactions)
      ? d.transactions.map((t: Record<string, unknown>) => ({
          dataType: (t.dataType as ExtractedFinancialData["transactions"][0]["dataType"]) || "expense",
          category: String(t.category || "Uncategorized"),
          subcategory: (t.subcategory as string) || null,
          amount: Math.abs(Number(t.amount) || 0),
          date: String(t.date || d.periodEnd || new Date().toISOString().split("T")[0]),
          description: (t.description as string) || null,
          metadata: (t.metadata as Record<string, unknown>) || null,
        }))
      : [],
    holdings: Array.isArray(d.holdings)
      ? d.holdings.map((h: Record<string, unknown>) => ({
          accountName: String(h.accountName || "Unknown Account"),
          symbol: String(h.symbol || "UNKNOWN"),
          assetClass: (h.assetClass as string) || null,
          quantity: Number(h.quantity) || 0,
          costBasis: Number(h.costBasis) || 0,
          currentValue: Number(h.currentValue) || 0,
          asOfDate: String(
            h.asOfDate || d.periodEnd || new Date().toISOString().split("T")[0]
          ),
        }))
      : [],
  };
}
