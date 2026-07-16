CREATE TABLE IF NOT EXISTS b2b_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_contact_id TEXT UNIQUE NOT NULL,
  location_id TEXT NOT NULL DEFAULT 'qwaeKgJBI8IG0GfFYnoa',
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  source TEXT,
  ad_name TEXT,
  ad_set_name TEXT,
  campaign_name TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  landing_page_source TEXT,
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  date_added TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_b2b_contacts_email ON b2b_contacts(email);
CREATE INDEX IF NOT EXISTS idx_b2b_contacts_date_added ON b2b_contacts(date_added DESC);
