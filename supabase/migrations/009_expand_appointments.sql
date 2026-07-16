-- Expand appointments table with all fields from Airtable Consultations table

ALTER TABLE appointments
  -- Consultation-specific outcome data
  ADD COLUMN IF NOT EXISTS consultation_outcome     TEXT,  -- 'Started Treatment', 'Pending Treatment', 'No Sale', 'Unqualified', etc.
  ADD COLUMN IF NOT EXISTS lead_quality_score       INT CHECK (lead_quality_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS treatment_value          NUMERIC,
  ADD COLUMN IF NOT EXISTS approved_for_financing   TEXT,  -- 'Yes', 'No', 'Pending'
  ADD COLUMN IF NOT EXISTS unqualified_reason       TEXT,
  ADD COLUMN IF NOT EXISTS appointment_notes        TEXT,
  ADD COLUMN IF NOT EXISTS outcome_notes            TEXT,

  -- Scheduling
  ADD COLUMN IF NOT EXISTS is_rescheduled           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reschedule_wanted        TEXT,  -- 'Yes', 'No', 'Maybe'
  ADD COLUMN IF NOT EXISTS booked_by_isa            TEXT,

  -- Ad attribution (from linked lead/campaign)
  ADD COLUMN IF NOT EXISTS campaign_name            TEXT,
  ADD COLUMN IF NOT EXISTS ad_set_name              TEXT,
  ADD COLUMN IF NOT EXISTS ad_name                  TEXT,

  -- Airtable sync
  ADD COLUMN IF NOT EXISTS airtable_record_id       TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_appointments_consultation_outcome ON appointments(consultation_outcome);
CREATE INDEX IF NOT EXISTS idx_appointments_airtable_record_id ON appointments(airtable_record_id);
