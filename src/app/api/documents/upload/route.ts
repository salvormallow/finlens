import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { createDocument, getDocumentByHash } from "@/lib/db/documents";
import type { DocumentType } from "@/types/financial";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/csv",
];

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

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const documentType = formData.get("documentType") as string;

    // Validate file
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 10MB)" },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    // Validate document type
    if (!VALID_DOC_TYPES.includes(documentType as DocumentType)) {
      return NextResponse.json(
        { error: "Invalid document type" },
        { status: 400 }
      );
    }

    // Compute SHA-256 hash of file contents
    const arrayBuffer = await file.arrayBuffer();
    const fileHash = createHash("sha256")
      .update(Buffer.from(arrayBuffer))
      .digest("hex");

    // Check for duplicate
    const existing = await getDocumentByHash(session.user.id, fileHash);
    if (existing) {
      return NextResponse.json(
        {
          error: "This file has already been uploaded",
          existingDocumentId: existing.id,
          existingFileName: existing.file_name,
        },
        { status: 409 }
      );
    }

    // Upload to Vercel Blob (temporary staging)
    const blob = await put(
      `staging/${session.user.id}/${Date.now()}-${file.name}`,
      new Blob([arrayBuffer], { type: file.type }),
      { access: "private" }
    );

    // Create document record in database
    const documentId = await createDocument({
      userId: session.user.id,
      documentType: documentType as DocumentType,
      fileName: file.name,
      blobUrl: blob.url,
      fileHash,
    });

    return NextResponse.json({
      documentId,
      fileName: file.name,
      blobUrl: blob.url,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
