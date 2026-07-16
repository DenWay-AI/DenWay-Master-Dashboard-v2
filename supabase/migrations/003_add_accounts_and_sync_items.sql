-- Migration 003: Add accounts, account_sources, and sync_run_items tables
-- Required for syncAll.ts orchestrator to work

-- Accounts table: Represents a business/agency using DenWay
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('DENWAY_B2B', 'CLIENT_B2C')),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Account Sources table: Links accounts to external systems (GHL, Meta, etc.)
CREATE TABLE IF NOT EXISTS account_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('GHL', 'META', 'GOOGLE_ADS', 'FATHOM')),
  external_id TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, source)
);

-- Sync Run Items table: Granular tracking per dataset per account
CREATE TABLE IF NOT EXISTS sync_run_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sync_run_id UUID NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  dataset TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  processed_count INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_is_active ON accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_account_sources_account_id ON account_sources(account_id);
CREATE INDEX IF NOT EXISTS idx_account_sources_source ON account_sources(source);
CREATE INDEX IF NOT EXISTS idx_account_sources_external_id ON account_sources(external_id);
CREATE INDEX IF NOT EXISTS idx_sync_run_items_sync_run_id ON sync_run_items(sync_run_id);
CREATE INDEX IF NOT EXISTS idx_sync_run_items_account_id ON sync_run_items(account_id);
CREATE INDEX IF NOT EXISTS idx_sync_run_items_dataset ON sync_run_items(dataset);

-- Update sync_runs table to add missing fields used by syncAll.ts
ALTER TABLE sync_runs 
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success_count INT DEFAULT 0;

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_account_sources_updated_at ON account_sources;
CREATE TRIGGER update_account_sources_updated_at
  BEFORE UPDATE ON account_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
