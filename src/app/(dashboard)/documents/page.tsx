"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileUp,
  FileText,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { StatusBadge } from "@/components/documents/status-badge";
import { DOCUMENT_TYPE_OPTIONS, DOCUMENT_TYPE_LABELS } from "@/lib/utils/documents";
import type { DocumentType, ProcessingStatus } from "@/types/financial";

interface DocumentItem {
  id: string;
  file_name: string;
  document_type: DocumentType;
  processing_status: ProcessingStatus;
  upload_date: string;
  period_start: string | null;
  period_end: string | null;
  error_message: string | null;
}

const DOCUMENT_CATEGORIES = [
  { type: "Bank Statements", description: "Checking & savings account statements" },
  { type: "Credit Card Statements", description: "Monthly credit card statements" },
  { type: "Pay Stubs", description: "Recent pay stubs from employers" },
  { type: "W-2 / 1099", description: "Tax documents from employers & institutions" },
  { type: "Tax Returns", description: "Federal and state tax returns" },
  { type: "Portfolio Statements", description: "Brokerage & retirement account statements" },
];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>("bank_statement");
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch documents on mount
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) throw new Error("Failed to fetch documents");
      const data = await res.json();
      setDocuments(data.documents);
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Upload and process a file
  async function handleUpload(file: File) {
    // Client-side validation
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large (max 10MB)");
      return;
    }

    const allowedExtensions = [".pdf", ".csv", ".txt"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!allowedExtensions.includes(ext)) {
      toast.error(`Unsupported file type: ${ext}. Use PDF, CSV, or TXT.`);
      return;
    }

    setUploading(true);
    const uploadToast = toast.loading(`Uploading ${file.name}...`);

    try {
      // Step 1: Upload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", selectedDocType);

      const uploadRes = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }

      const { documentId } = await uploadRes.json();

      // Add to local state immediately
      setDocuments((prev) => [
        {
          id: documentId,
          file_name: file.name,
          document_type: selectedDocType,
          processing_status: "pending" as ProcessingStatus,
          upload_date: new Date().toISOString(),
          period_start: null,
          period_end: null,
          error_message: null,
        },
        ...prev,
      ]);

      toast.loading(`Processing ${file.name} with AI...`, { id: uploadToast });

      // Update status to processing in local state
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === documentId
            ? { ...d, processing_status: "processing" as ProcessingStatus }
            : d
        )
      );

      // Step 2: Process
      const processRes = await fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
      });

      if (!processRes.ok) {
        const err = await processRes.json();
        throw new Error(err.details || err.error || "Processing failed");
      }

      const result = await processRes.json();

      // Update local state
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === documentId
            ? { ...d, processing_status: "completed" as ProcessingStatus }
            : d
        )
      );

      toast.success(
        `Extracted ${result.transactionsCount} transactions from ${file.name}`,
        { id: uploadToast }
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed: ${msg}`, { id: uploadToast });

      // Refresh to get accurate status
      fetchDocuments();
    } finally {
      setUploading(false);
    }
  }

  // Delete a document
  async function handleDelete(docId: string, fileName: string) {
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success(`Deleted ${fileName}`);
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  }

  // Drag and drop handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0 && !uploading) {
      handleUpload(files[0]);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0 && !uploading) {
      handleUpload(files[0]);
    }
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground text-sm">
          Upload and manage your financial documents
        </p>
      </div>

      {/* Upload Zone */}
      <Card>
        <CardContent className="pt-6">
          {/* Document type selector */}
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-medium">Document type:</label>
            <select
              value={selectedDocType}
              onChange={(e) =>
                setSelectedDocType(e.target.value as DocumentType)
              }
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              disabled={uploading}
            >
              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => !uploading && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                !uploading && fileInputRef.current?.click();
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />

            {uploading ? (
              <>
                <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
                <h3 className="text-lg font-medium mb-2">
                  Processing document...
                </h3>
                <p className="text-sm text-muted-foreground">
                  Extracting financial data with AI. This may take a moment.
                </p>
              </>
            ) : (
              <>
                <FileUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  Drag & drop files here
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  or click to browse your files
                </p>
                <div className="flex items-center justify-center gap-4 mb-4">
                  <span className="text-xs text-muted-foreground">
                    Supported: PDF, CSV, TXT (max 10MB)
                  </span>
                </div>
                <Button>
                  <FileUp className="mr-2 h-4 w-4" />
                  Select File
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Document Categories Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommended Documents</CardTitle>
          <CardDescription>
            Upload these documents for the most comprehensive financial analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DOCUMENT_CATEGORIES.map((cat) => (
              <div
                key={cat.type}
                className="flex items-start gap-3 p-3 rounded-lg border border-border"
              >
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{cat.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {cat.description}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="ml-auto text-[10px] shrink-0"
                >
                  Needed
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uploaded Documents</CardTitle>
          <CardDescription>
            Your processed financial documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No documents uploaded yet</p>
              <p className="text-xs mt-1">
                Upload your first document to get started
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {doc.file_name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {DOCUMENT_TYPE_LABELS[doc.document_type] ||
                          doc.document_type}
                      </span>
                      <span>{'·'}</span>
                      <span>{formatDate(doc.upload_date)}</span>
                      {doc.period_start && doc.period_end && (
                        <>
                          <span>{'·'}</span>
                          <span>
                            {formatDate(doc.period_start)} –{" "}
                            {formatDate(doc.period_end)}
                          </span>
                        </>
                      )}
                    </div>
                    {doc.processing_status === "failed" && doc.error_message && (
                      <p className="text-xs text-destructive mt-1 truncate">
                        {doc.error_message}
                      </p>
                    )}
                  </div>

                  <StatusBadge status={doc.processing_status} />

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(doc.id, doc.file_name)}
                    disabled={
                      deletingId === doc.id ||
                      doc.processing_status === "processing"
                    }
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
