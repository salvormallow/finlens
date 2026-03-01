import type { DocumentType } from "@/types/financial";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  bank_statement: "Bank Statement",
  w2: "W-2",
  tax_return: "Tax Return",
  portfolio_statement: "Portfolio Statement",
  credit_card_statement: "Credit Card Statement",
  pay_stub: "Pay Stub",
  "1099": "1099",
  other: "Other",
};

export const DOCUMENT_TYPE_OPTIONS: {
  value: DocumentType;
  label: string;
}[] = [
  { value: "bank_statement", label: "Bank Statement" },
  { value: "credit_card_statement", label: "Credit Card Statement" },
  { value: "pay_stub", label: "Pay Stub" },
  { value: "w2", label: "W-2" },
  { value: "1099", label: "1099" },
  { value: "tax_return", label: "Tax Return" },
  { value: "portfolio_statement", label: "Portfolio Statement" },
  { value: "other", label: "Other" },
];
