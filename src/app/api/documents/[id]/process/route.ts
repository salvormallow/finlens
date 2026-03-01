import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { extractTextFromFile } from "@/lib/documents/parse";
import { extractFinancialData } from "@/lib/ai/extract";
import {
  getDocumentById,
  updateDocumentStatus,
  updateDocumentPeriod,
  insertFinancialData,
  findOrCreateAccount,
  upsertPortfolioHolding,
} from "@/lib/db/documents";

// Allow up to 60 seconds for processing (Claude API + text extraction)
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Verify document exists and belongs to user
  const doc = await getDocumentById(documentId, userId);
  if (!doc) {
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404 }
    );
  }
  if (doc.processing_status !== "pending") {
    return NextResponse.json(
      { error: "Document already processed or processing" },
      { status: 409 }
    );
  }
  if (!doc.blob_url) {
    return NextResponse.json(
      { error: "No file to process" },
      { status: 400 }
    );
  }

  // Mark as processing
  await updateDocumentStatus(documentId, userId, "processing");

  try {
    // 1. Download file from blob (private store requires token)
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    const response = await fetch(doc.blob_url, {
      headers: blobToken ? { Authorization: `Bearer ${blobToken}` } : {},
    });
    if (!response.ok) {
      throw new Error("Failed to download file from blob storage");
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Extract text
    const mimeType = response.headers.get("content-type") || "application/pdf";
    const text = await extractTextFromFile(buffer, mimeType);

    if (!text.trim()) {
      throw new Error(
        "No text could be extracted from the document. The file may be image-based or empty."
      );
    }

    // 3. Send to Claude for structured extraction
    const extracted = await extractFinancialData(text, doc.document_type);

    // 4. Update document period
    await updateDocumentPeriod(
      documentId,
      userId,
      extracted.periodStart,
      extracted.periodEnd
    );

    // 5. Create/find accounts
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

    // 6. Insert financial data (transactions)
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

    // 7. Insert portfolio holdings
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

    // 8. Cleanup: delete blob
    try {
      await del(doc.blob_url);
    } catch (e) {
      console.warn("Failed to delete blob (non-fatal):", e);
    }

    // 9. Mark completed
    await updateDocumentStatus(documentId, userId, "completed");

    return NextResponse.json({
      status: "completed",
      documentType: extracted.documentType,
      transactionsCount: extracted.transactions.length,
      accountsCount: extracted.accounts.length,
      holdingsCount: extracted.holdings.length,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown processing error";
    console.error("Processing error:", error);

    await updateDocumentStatus(documentId, userId, "failed", errorMessage);

    return NextResponse.json(
      { error: "Processing failed", details: errorMessage },
      { status: 500 }
    );
  }
}
