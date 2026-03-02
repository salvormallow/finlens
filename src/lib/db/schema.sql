-- FinLens Database Schema
-- Run against Vercel Postgres / Neon

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
    'bank_statement', 'w2', 'tax_return', 'portfolio_statement',
    'credit_card_statement', 'pay_stub', '1099', 'other'
  )),
  file_name VARCHAR(500) NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  period_start DATE,
  period_end DATE,
  processing_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (processing_status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(processing_status);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN (
    'checking', 'savings', 'brokerage', 'credit_card', 'retirement', 'other'
  )),
  institution VARCHAR(255),
  last_updated TIMESTAMP WITH TIME ZONE,
  source VARCHAR(20) NOT NULL DEFAULT 'manual_upload' CHECK (source IN (
    'manual_upload', 'plaid', 'api'
  ))
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- Financial data table (amounts and metadata are encrypted at app level)
CREATE TABLE IF NOT EXISTS financial_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data_type VARCHAR(20) NOT NULL CHECK (data_type IN (
    'income', 'expense', 'asset', 'liability', 'investment', 'tax'
  )),
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  amount TEXT NOT NULL, -- encrypted
  date DATE NOT NULL,
  description TEXT,
  metadata_json TEXT, -- encrypted JSON
  source VARCHAR(20) NOT NULL DEFAULT 'manual_upload',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_financial_data_user_id ON financial_data(user_id);
CREATE INDEX idx_financial_data_type ON financial_data(data_type);
CREATE INDEX idx_financial_data_date ON financial_data(date);
CREATE INDEX idx_financial_data_document ON financial_data(document_id);

-- Portfolio holdings table (cost_basis and current_value are encrypted at app level)
CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  asset_class VARCHAR(50),
  quantity DECIMAL(18, 8) NOT NULL,
  cost_basis TEXT NOT NULL, -- encrypted
  current_value TEXT NOT NULL, -- encrypted
  as_of_date DATE NOT NULL
);

CREATE INDEX idx_portfolio_user_id ON portfolio_holdings(user_id);
CREATE INDEX idx_portfolio_account_id ON portfolio_holdings(account_id);

-- Analysis cache table (result_json is encrypted at app level)
CREATE TABLE IF NOT EXISTS analysis_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  analysis_type VARCHAR(30) NOT NULL CHECK (analysis_type IN (
    'net_worth', 'income_expense', 'portfolio', 'tax_overview',
    'cash_flow', 'recommendations', 'gap_detection'
  )),
  data_hash VARCHAR(64) NOT NULL,
  result_json TEXT NOT NULL, -- encrypted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_analysis_cache_user ON analysis_cache(user_id, analysis_type);

-- Chat history table
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_history_user ON chat_history(user_id);
CREATE INDEX idx_chat_history_created ON chat_history(created_at);

-- Document requests table (gap detection)
CREATE TABLE IF NOT EXISTS document_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type_needed VARCHAR(50) NOT NULL,
  reason TEXT NOT NULL,
  priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_document_requests_user ON document_requests(user_id);

-- Goals table (target_amount and current_amount are encrypted at app level)
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  goal_type VARCHAR(30) NOT NULL CHECK (goal_type IN (
    'emergency_fund', 'debt_payoff', 'savings', 'net_worth', 'retirement', 'custom'
  )),
  target_amount TEXT NOT NULL, -- encrypted
  current_amount TEXT, -- encrypted, computed on read
  deadline DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  ai_insight TEXT,
  ai_insight_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_goals_user ON goals(user_id);
CREATE INDEX idx_goals_status ON goals(user_id, status);
