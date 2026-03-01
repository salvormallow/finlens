import Anthropic from "@anthropic-ai/sdk";
import type { DocumentType, DataType, AccountType } from "@/types/financial";

const anthropic = new Anthropic();

// ─── Response type from Claude ───────────────────────────────────

export interface ExtractedFinancialData {
  documentType: DocumentType;
  periodStart: string | null; // YYYY-MM-DD
  periodEnd: string | null;
  accounts: Array<{
    accountName: string;
    accountType: AccountType;
    institution: string | null;
  }>;
  transactions: Array<{
    dataType: DataType;
    category: string;
    subcategory: string | null;
    amount: number;
    date: string; // YYYY-MM-DD
    description: string | null;
    metadata: Record<string, unknown> | null;
  }>;
  holdings: Array<{
    accountName: string;
    symbol: string;
    assetClass: string | null;
    quantity: number;
    costBasis: number;
    currentValue: number;
    asOfDate: string;
  }>;
}

// ─── System prompt ───────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a financial document parser. Extract structured financial data from the document text provided.

Return ONLY valid JSON matching this exact schema (no markdown, no explanation, no code fences):

{
  "documentType": one of ["bank_statement", "w2", "tax_return", "portfolio_statement", "credit_card_statement", "pay_stub", "1099", "other"],
  "periodStart": "YYYY-MM-DD" or null,
  "periodEnd": "YYYY-MM-DD" or null,
  "accounts": [
    {
      "accountName": "string (e.g., 'Chase Checking ...1234')",
      "accountType": one of ["checking", "savings", "brokerage", "credit_card", "retirement", "other"],
      "institution": "string or null"
    }
  ],
  "transactions": [
    {
      "dataType": one of ["income", "expense", "asset", "liability", "investment", "tax"],
      "category": "string (e.g., 'Housing', 'Food & Dining', 'Employment', 'Utilities')",
      "subcategory": "string or null (e.g., 'Rent', 'Groceries', 'Salary')",
      "amount": positive number (use absolute value, no currency symbols),
      "date": "YYYY-MM-DD",
      "description": "string or null (brief transaction description)",
      "metadata": object or null
    }
  ],
  "holdings": [
    {
      "accountName": "string (must match an account above)",
      "symbol": "string (ticker symbol)",
      "assetClass": "string or null (e.g., 'US Equity', 'International Equity', 'Fixed Income', 'Cash')",
      "quantity": number,
      "costBasis": number,
      "currentValue": number,
      "asOfDate": "YYYY-MM-DD"
    }
  ]
}

CATEGORIZATION RULES:
- Bank deposits, payroll, direct deposits -> dataType "income"
- Debits, purchases, payments, fees -> dataType "expense"
- Account balances (checking, savings) -> dataType "asset"
- Credit card balances, loans -> dataType "liability"
- Stock/fund buys/sells -> dataType "investment"
- Tax withholdings, estimated payments -> dataType "tax"
- W-2: Extract gross wages as "income" (category "Employment"), federal/state tax withheld as "tax", Social Security/Medicare as "tax"
- 1099: Extract reported income, categorize by type (interest, dividends, etc.)
- Always use POSITIVE amounts. The dataType field distinguishes direction.
- If a date is ambiguous, use the document period end date.
- Use empty arrays [] for missing sections (e.g., no holdings in a bank statement).
- For bank statements: extract individual transactions AND the ending balance as an "asset" entry.
- For portfolio statements: extract each holding with current values AND individual buy/sell transactions if visible.`;

// ─── Main extraction function ────────────────────────────────────

export async function extractFinancialData(
  documentText: string,
  hintDocumentType?: DocumentType
): Promise<ExtractedFinancialData> {
  // Truncate to ~100K chars to stay within context limits
  const truncatedText = documentText.slice(0, 100_000);

  const hint = hintDocumentType
    ? `Document type hint: ${hintDocumentType}`
    : "Document type: auto-detect";

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16384,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${hint}\n\n--- DOCUMENT TEXT ---\n${truncatedText}\n---\n\nParse this financial document and return the structured JSON.`,
      },
    ],
  });

  // Extract text content from response
  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Parse JSON, handling potential markdown code fences
  const parsed = parseJsonResponse(responseText);

  // Validate and return
  return validateExtractedData(parsed);
}

// ─── Helpers ─────────────────────────────────────────────────────

function parseJsonResponse(text: string): unknown {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    // Remove opening fence (```json or ```)
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "");
    // Remove closing fence if present
    cleaned = cleaned.replace(/\n?```\s*$/, "");
  }
  cleaned = cleaned.trim();

  // Try direct JSON parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall through to extraction
  }

  // Try finding the outermost JSON object
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace !== -1) {
    const jsonCandidate = cleaned.slice(firstBrace);
    try {
      return JSON.parse(jsonCandidate);
    } catch {
      // Response may be truncated — try to repair by closing open structures
      const repaired = repairTruncatedJson(jsonCandidate);
      if (repaired) {
        try {
          return JSON.parse(repaired);
        } catch {
          // Fall through
        }
      }
    }
  }

  throw new Error(
    `Failed to parse Claude response as JSON. Response starts with: ${text.slice(0, 200)}`
  );
}

function repairTruncatedJson(text: string): string | null {
  // Count unclosed brackets and braces to close them
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;

  for (const ch of text) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;
  }

  if (braces <= 0 && brackets <= 0) return null; // not truncated

  // Trim trailing partial tokens (incomplete strings, trailing commas)
  let repaired = text.replace(/,\s*$/, "");
  if (inString) repaired += '"';
  // Remove trailing partial key-value if it ends mid-value
  repaired = repaired.replace(/,\s*"[^"]*":\s*$/, "");
  repaired = repaired.replace(/,\s*"[^"]*$/, "");

  // Close open structures
  for (let i = 0; i < brackets; i++) repaired += "]";
  for (let i = 0; i < braces; i++) repaired += "}";

  return repaired;
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
          accountType: (a.accountType as AccountType) || "other",
          institution: (a.institution as string) || null,
        }))
      : [],
    transactions: Array.isArray(d.transactions)
      ? d.transactions.map((t: Record<string, unknown>) => ({
          dataType: (t.dataType as DataType) || "expense",
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
