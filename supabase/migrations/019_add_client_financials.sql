-- Add missing financial columns to clients (from Airtable Partners backfill)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS cash_collected    NUMERIC,
  ADD COLUMN IF NOT EXISTS deal_structure    TEXT,
  ADD COLUMN IF NOT EXISTS paid_to_date      NUMERIC;
