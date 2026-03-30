import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDocumentById } from "@/lib/db/documents";
import { processDocument } from "@/lib/services/documents";

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

  const { result } = await processDocument(
    documentId,
    userId,
    doc.blob_url,
    doc.document_type
  );

  if (result.status === "failed") {
    return NextResponse.json(
      { error: "Processing failed", details: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: result.status,
    documentType: result.documentType,
    transactionsCount: result.transactionsCount,
    accountsCount: result.accountsCount,
    holdingsCount: result.holdingsCount,
  });
}
