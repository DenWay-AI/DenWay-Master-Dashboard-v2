import { Client } from 'pg'

const DB_URL = 'postgresql://postgres.lkuejxtwdofclhkcwpic:SuccessLovesSpeed1!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'

const migrations = [
  {
    name: '020_add_fathom_url_to_b2b',
    sql: `ALTER TABLE b2b_sales_tracker ADD COLUMN IF NOT EXISTS fathom_url text;`,
  },
  {
    name: '021_b2b_contacts',
    sql: `
CREATE TABLE IF NOT EXISTS b2b_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_contact_id TEXT UNIQUE NOT NULL,
  location_id TEXT NOT NULL DEFAULT 'qwaeKgJBI8IG0GfFYnoa',
  first_name TEXT, last_name TEXT, full_name TEXT,
  email TEXT, phone TEXT, company_name TEXT,
  source TEXT, ad_name TEXT, ad_set_name TEXT, campaign_name TEXT,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
  utm_content TEXT, utm_term TEXT, landing_page_source TEXT,
  tags TEXT[], custom_fields JSONB DEFAULT '{}',
  date_added TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_b2b_contacts_email ON b2b_contacts(email);
CREATE INDEX IF NOT EXISTS idx_b2b_contacts_date_added ON b2b_contacts(date_added DESC);
    `,
  },
  {
    name: '022_b2b_contacts_opportunity',
    sql: `
ALTER TABLE b2b_contacts
  ADD COLUMN IF NOT EXISTS opportunity_id TEXT,
  ADD COLUMN IF NOT EXISTS opportunity_name TEXT,
  ADD COLUMN IF NOT EXISTS opportunity_status TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_stage_id TEXT,
  ADD COLUMN IF NOT EXISTS opportunity_monetary_value NUMERIC,
  ADD COLUMN IF NOT EXISTS opportunity_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opportunity_updated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_b2b_contacts_opportunity_id ON b2b_contacts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_b2b_contacts_pipeline_stage ON b2b_contacts(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_b2b_contacts_opp_status ON b2b_contacts(opportunity_status);
    `,
  },
  {
    name: '023_meta_ad_level_insights',
    sql: `
CREATE TABLE IF NOT EXISTS meta_ad_level_insights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_id         TEXT NOT NULL,
  ad_name       TEXT,
  adset_id      TEXT,
  adset_name    TEXT,
  campaign_id   TEXT,
  campaign_name TEXT,
  date          DATE NOT NULL,
  spend         NUMERIC DEFAULT 0,
  impressions   INTEGER DEFAULT 0,
  reach         INTEGER DEFAULT 0,
  clicks        INTEGER DEFAULT 0,
  leads         INTEGER DEFAULT 0,
  synced_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, ad_id, date)
);
CREATE INDEX IF NOT EXISTS idx_mali_client_date ON meta_ad_level_insights(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_mali_ad_name     ON meta_ad_level_insights(ad_name);
CREATE INDEX IF NOT EXISTS idx_mali_campaign    ON meta_ad_level_insights(campaign_name);
CREATE TABLE IF NOT EXISTS meta_ad_statuses (
  ad_id            TEXT NOT NULL,
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ad_name          TEXT,
  adset_id         TEXT,
  adset_name       TEXT,
  campaign_id      TEXT,
  campaign_name    TEXT,
  status           TEXT,
  effective_status TEXT,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ad_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_mas_client ON meta_ad_statuses(client_id);
    `,
  },
]

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected to Supabase Postgres\n')

  for (const m of migrations) {
    process.stdout.write(`Running ${m.name}... `)
    try {
      await client.query(m.sql)
      console.log('✓')
    } catch (e: any) {
      console.log(`✗ ${e.message}`)
    }
  }

  await client.end()
  console.log('\nDone.')
}

main().catch(e => { console.error(e); process.exit(1) })
