import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadDocument } from "@/lib/services/documents";
import type { DocumentType } from "@/types/financial";

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

const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/csv",
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

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }
    if (!VALID_DOC_TYPES.includes(documentType as DocumentType)) {
      return NextResponse.json(
        { error: "Invalid document type" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadDocument({
      userId: session.user.id,
      file: { name: file.name, type: file.type, buffer },
      documentType: documentType as DocumentType,
    });

    if (result.duplicate) {
      return NextResponse.json(
        {
          error: "This file has already been uploaded",
          existingDocumentId: result.documentId,
          existingFileName: result.fileName,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      documentId: result.documentId,
      fileName: result.fileName,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
