-- Migration 014: Add Meta ad account ID to clients
-- This links each client to their Meta Ads Manager ad account (format: act_XXXXXXXXX)

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS meta_ad_account_id TEXT;  -- e.g. act_1234567890

COMMENT ON COLUMN clients.meta_ad_account_id IS 'Meta Ads Manager ad account ID (format: act_XXXXXXXXX). Required for Meta ads sync.';
