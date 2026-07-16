-- Add calendar tracking and company name to appointments for B2B strategy session filtering

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS ghl_calendar_id TEXT,
  ADD COLUMN IF NOT EXISTS company_name    TEXT;  -- practice name from GHL contact.companyName

CREATE INDEX IF NOT EXISTS idx_appointments_ghl_calendar_id ON appointments(ghl_calendar_id);
