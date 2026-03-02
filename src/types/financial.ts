// ============================================
// FinLens - Financial Data Type Definitions
// ============================================

// --- Enums ---

export type DocumentType =
  | "bank_statement"
  | "w2"
  | "tax_return"
  | "portfolio_statement"
  | "credit_card_statement"
  | "pay_stub"
  | "1099"
  | "other";

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type DataType =
  | "income"
  | "expense"
  | "asset"
  | "liability"
  | "investment"
  | "tax";

export type AccountType =
  | "checking"
  | "savings"
  | "brokerage"
  | "credit_card"
  | "retirement"
  | "other";

export type AnalysisType =
  | "net_worth"
  | "income_expense"
  | "portfolio"
  | "tax_overview"
  | "cash_flow"
  | "recommendations"
  | "gap_detection";

export type DocumentRequestStatus = "pending" | "fulfilled";

export type DataSource = "manual_upload" | "plaid" | "api";

export type Priority = "high" | "medium" | "low";

// --- Database Row Types ---

export interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface Document {
  id: string;
  user_id: string;
  document_type: DocumentType;
  file_name: string;
  blob_url: string | null;
  file_hash: string | null;
  upload_date: Date;
  period_start: Date | null;
  period_end: Date | null;
  processing_status: ProcessingStatus;
  error_message: string | null;
  created_at: Date;
}

export interface FinancialData {
  id: string;
  document_id: string;
  user_id: string;
  data_type: DataType;
  category: string;
  subcategory: string | null;
  amount: number; // decrypted at application level
  date: Date;
  description: string | null;
  metadata_json: Record<string, unknown> | null; // decrypted at application level
  source: DataSource;
  created_at: Date;
}

export interface Account {
  id: string;
  user_id: string;
  account_name: string;
  account_type: AccountType;
  institution: string | null;
  last_updated: Date | null;
  source: DataSource;
}

export interface PortfolioHolding {
  id: string;
  user_id: string;
  account_id: string;
  symbol: string;
  asset_class: string | null;
  quantity: number;
  cost_basis: number; // decrypted
  current_value: number; // decrypted
  as_of_date: Date;
}

export interface AnalysisCache {
  id: string;
  user_id: string;
  analysis_type: AnalysisType;
  data_hash: string;
  result_json: Record<string, unknown>; // decrypted
  created_at: Date;
  expires_at: Date;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: Date;
}

export interface DocumentRequest {
  id: string;
  user_id: string;
  document_type_needed: DocumentType;
  reason: string;
  priority: Priority;
  status: DocumentRequestStatus;
  created_at: Date;
}

// --- API/UI Types ---

export interface FinancialSummary {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  lastUpdated: Date | null;
}

export interface NetWorthTrend {
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  color?: string;
}

export interface MonthlyPnL {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface PortfolioAllocation {
  assetClass: string;
  value: number;
  percentage: number;
  color?: string;
}

export interface HoldingSummary {
  symbol: string;
  assetClass: string;
  quantity: number;
  costBasis: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

export interface Recommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  estimatedImpact: string | null;
  priority: Priority;
  actionItems: string[];
}

export interface DocumentGap {
  documentType: DocumentType;
  reason: string;
  priority: Priority;
  status: DocumentRequestStatus;
}

export interface UploadedFile {
  id: string;
  fileName: string;
  documentType: DocumentType;
  status: ProcessingStatus;
  uploadDate: Date;
  periodStart: Date | null;
  periodEnd: Date | null;
}

export interface CashFlowItem {
  name: string;
  value: number;
}

export interface TaxOverview {
  estimatedLiability: number;
  withholdingsYtd: number;
  estimatedBalanceDue: number;
  hasData: boolean;
}

export interface DashboardRecommendation {
  priority: Priority;
  text: string;
}

export interface DashboardData {
  hasData: boolean;
  summary: FinancialSummary;
  summaryPriorMonth: {
    netWorth: number;
    monthlyIncome: number;
    monthlyExpenses: number;
  } | null;
  netWorthTrend: NetWorthTrend[];
  monthlyPnL: MonthlyPnL[];
  portfolioAllocation: PortfolioAllocation[];
  cashFlow: CashFlowItem[];
  taxOverview: TaxOverview;
  recommendations: DashboardRecommendation[];
}
