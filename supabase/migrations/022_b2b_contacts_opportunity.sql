-- Add GHL opportunity/pipeline fields to b2b_contacts
ALTER TABLE b2b_contacts
  ADD COLUMN IF NOT EXISTS opportunity_id          TEXT,
  ADD COLUMN IF NOT EXISTS opportunity_name        TEXT,
  ADD COLUMN IF NOT EXISTS opportunity_status      TEXT,   -- open | won | lost | abandoned
  ADD COLUMN IF NOT EXISTS pipeline_stage          TEXT,   -- human-readable stage name
  ADD COLUMN IF NOT EXISTS pipeline_stage_id       TEXT,
  ADD COLUMN IF NOT EXISTS opportunity_monetary_value NUMERIC,
  ADD COLUMN IF NOT EXISTS opportunity_created_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opportunity_updated_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_b2b_contacts_opportunity_id  ON b2b_contacts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_b2b_contacts_pipeline_stage  ON b2b_contacts(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_b2b_contacts_opp_status      ON b2b_contacts(opportunity_status);
