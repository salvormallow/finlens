import { sql } from "@vercel/postgres";

export { sql };

// Initialize database tables from schema
export async function initializeDatabase() {
  // Create extension
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

  // Users
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // Documents
  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_type VARCHAR(50) NOT NULL,
      file_name VARCHAR(500) NOT NULL,
      upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      period_start DATE,
      period_end DATE,
      processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // Accounts
  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_name VARCHAR(255) NOT NULL,
      account_type VARCHAR(20) NOT NULL,
      institution VARCHAR(255),
      last_updated TIMESTAMP WITH TIME ZONE,
      source VARCHAR(20) NOT NULL DEFAULT 'manual_upload'
    )
  `;

  // Financial data
  await sql`
    CREATE TABLE IF NOT EXISTS financial_data (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data_type VARCHAR(20) NOT NULL,
      category VARCHAR(100) NOT NULL,
      subcategory VARCHAR(100),
      amount TEXT NOT NULL,
      date DATE NOT NULL,
      description TEXT,
      metadata_json TEXT,
      source VARCHAR(20) NOT NULL DEFAULT 'manual_upload',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // Portfolio holdings
  await sql`
    CREATE TABLE IF NOT EXISTS portfolio_holdings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      symbol VARCHAR(20) NOT NULL,
      asset_class VARCHAR(50),
      quantity DECIMAL(18, 8) NOT NULL,
      cost_basis TEXT NOT NULL,
      current_value TEXT NOT NULL,
      as_of_date DATE NOT NULL
    )
  `;

  // Analysis cache
  await sql`
    CREATE TABLE IF NOT EXISTS analysis_cache (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      analysis_type VARCHAR(30) NOT NULL,
      data_hash VARCHAR(64) NOT NULL,
      result_json TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL
    )
  `;

  // Chat history
  await sql`
    CREATE TABLE IF NOT EXISTS chat_history (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(10) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // Document requests
  await sql`
    CREATE TABLE IF NOT EXISTS document_requests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_type_needed VARCHAR(50) NOT NULL,
      reason TEXT NOT NULL,
      priority VARCHAR(10) NOT NULL DEFAULT 'medium',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // Goals
  await sql`
    CREATE TABLE IF NOT EXISTS goals (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      goal_type VARCHAR(30) NOT NULL,
      target_amount TEXT NOT NULL,
      current_amount TEXT,
      deadline DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      ai_insight TEXT,
      ai_insight_updated_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // Financial reports (AI narrative)
  await sql`
    CREATE TABLE IF NOT EXISTS financial_reports (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      report_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
      period_label VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      data_hash VARCHAR(64) NOT NULL,
      tone VARCHAR(20) NOT NULL DEFAULT 'concise',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // Phase 2 migration: add blob_url to documents
  await sql`
    ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS blob_url TEXT
  `;

  // Phase 2b migration: add file_hash for duplicate detection
  await sql`
    ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64)
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_user_file_hash
    ON documents (user_id, file_hash)
    WHERE file_hash IS NOT NULL
  `;
}
