-- Expand clients table with all fields from Airtable Partners table

ALTER TABLE clients
  -- Identity
  ADD COLUMN IF NOT EXISTS legal_business_name    TEXT,
  ADD COLUMN IF NOT EXISTS owner_name             TEXT,
  ADD COLUMN IF NOT EXISTS doctor_name            TEXT,
  ADD COLUMN IF NOT EXISTS owner_email            TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone            TEXT,
  ADD COLUMN IF NOT EXISTS personal_phone         TEXT,
  ADD COLUMN IF NOT EXISTS front_desk_phone       TEXT,
  ADD COLUMN IF NOT EXISTS company_email          TEXT,
  ADD COLUMN IF NOT EXISTS city                   TEXT,
  ADD COLUMN IF NOT EXISTS business_address       TEXT,
  ADD COLUMN IF NOT EXISTS state                  TEXT,
  ADD COLUMN IF NOT EXISTS zip_code               TEXT,
  ADD COLUMN IF NOT EXISTS country                TEXT,
  ADD COLUMN IF NOT EXISTS area                   TEXT,

  -- Ops & health
  ADD COLUMN IF NOT EXISTS onboarding_status      TEXT,
  ADD COLUMN IF NOT EXISTS priority               TEXT,
  ADD COLUMN IF NOT EXISTS defcon_status          TEXT,
  ADD COLUMN IF NOT EXISTS service_type           TEXT CHECK (service_type IN ('DFY', 'DWY')),
  ADD COLUMN IF NOT EXISTS launched               BOOLEAN DEFAULT FALSE,

  -- Financials
  ADD COLUMN IF NOT EXISTS payment_plan           TEXT CHECK (payment_plan IN ('pay_per_show', 'pay_per_patient', 'retainer', 'pif')),
  ADD COLUMN IF NOT EXISTS pps_fee                NUMERIC,
  ADD COLUMN IF NOT EXISTS ppp_fee                NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_retainer_usd   NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_retainer_dkk   NUMERIC,
  ADD COLUMN IF NOT EXISTS enrollment_fee         NUMERIC,
  ADD COLUMN IF NOT EXISTS sms_fees               NUMERIC,
  ADD COLUMN IF NOT EXISTS currency               TEXT,
  ADD COLUMN IF NOT EXISTS daily_ad_spend_agreed  NUMERIC,
  ADD COLUMN IF NOT EXISTS date_closed            DATE,

  -- Team assignments
  ADD COLUMN IF NOT EXISTS closer_name            TEXT,
  ADD COLUMN IF NOT EXISTS csm_name               TEXT,
  ADD COLUMN IF NOT EXISTS media_buyer_name       TEXT,

  -- Links & metadata
  ADD COLUMN IF NOT EXISTS website_url            TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url           TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_url       TEXT,
  ADD COLUMN IF NOT EXISTS time_zone              TEXT,
  ADD COLUMN IF NOT EXISTS consultation_hours     TEXT,
  ADD COLUMN IF NOT EXISTS offer                  TEXT,
  ADD COLUMN IF NOT EXISTS deal_description       TEXT,
  ADD COLUMN IF NOT EXISTS slack_channel_id       TEXT,
  ADD COLUMN IF NOT EXISTS fathom_link            TEXT,
  ADD COLUMN IF NOT EXISTS total_locations        INT,

  -- Practice details
  ADD COLUMN IF NOT EXISTS accepts_spanish_patients BOOLEAN,
  ADD COLUMN IF NOT EXISTS financing_options        BOOLEAN,

  -- Onboarding checklist
  ADD COLUMN IF NOT EXISTS contract_signed        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paid                   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ads_setup              BOOLEAN DEFAULT FALSE,

  -- Airtable sync
  ADD COLUMN IF NOT EXISTS airtable_record_id     TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_clients_airtable_record_id ON clients(airtable_record_id);
CREATE INDEX IF NOT EXISTS idx_clients_country ON clients(country);
CREATE INDEX IF NOT EXISTS idx_clients_payment_plan ON clients(payment_plan);
