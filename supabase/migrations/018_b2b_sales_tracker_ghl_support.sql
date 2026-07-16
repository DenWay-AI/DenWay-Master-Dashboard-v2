-- Allow records from GHL (not just Airtable)
ALTER TABLE b2b_sales_tracker ALTER COLUMN airtable_record_id DROP NOT NULL;

-- Unique key for GHL-sourced records (prevents duplicates on sync)
ALTER TABLE b2b_sales_tracker ADD COLUMN IF NOT EXISTS ghl_appointment_id text UNIQUE;

CREATE INDEX IF NOT EXISTS b2b_sales_tracker_ghl_appointment_id_idx ON b2b_sales_tracker(ghl_appointment_id);
