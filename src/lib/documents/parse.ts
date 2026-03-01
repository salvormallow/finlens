// pdf-parse v1 doesn't have proper ESM exports
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

export async function extractTextFromPdf(
  buffer: Buffer
): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text;
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf" || mimeType === "application/octet-stream") {
    return extractTextFromPdf(buffer);
  }

  if (
    mimeType === "text/plain" ||
    mimeType === "text/csv" ||
    mimeType === "application/csv"
  ) {
    return buffer.toString("utf-8");
  }

  // Fallback: try PDF parse for unknown types (often blob storage returns generic types)
  try {
    return await extractTextFromPdf(buffer);
  } catch {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
}
