-- Migration 006: Meta Ads daily snapshots per client

CREATE TABLE IF NOT EXISTS meta_ad_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  spend NUMERIC DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks INT DEFAULT 0,
  leads INT DEFAULT 0,
  cpl NUMERIC,          -- cost per lead (spend / leads)
  ctr NUMERIC,          -- click-through rate
  raw JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, date)
);

CREATE INDEX IF NOT EXISTS idx_meta_snapshots_client_id ON meta_ad_snapshots(client_id);
CREATE INDEX IF NOT EXISTS idx_meta_snapshots_date ON meta_ad_snapshots(date);
CREATE INDEX IF NOT EXISTS idx_meta_snapshots_client_date ON meta_ad_snapshots(client_id, date);
