import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS meta_ad_level_insights (
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
    )`,
    `CREATE INDEX IF NOT EXISTS idx_mali_client_date ON meta_ad_level_insights(client_id, date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_mali_ad_name     ON meta_ad_level_insights(ad_name)`,
    `CREATE INDEX IF NOT EXISTS idx_mali_campaign    ON meta_ad_level_insights(campaign_name)`,
    `CREATE TABLE IF NOT EXISTS meta_ad_statuses (
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
    )`,
    `CREATE INDEX IF NOT EXISTS idx_mas_client ON meta_ad_statuses(client_id)`,
  ]

  for (const sql of statements) {
    const label = sql.slice(0, 60).replace(/\s+/g, ' ')
    process.stdout.write(`  ${label}… `)
    const { error } = await sb.from('_dummy_').select().limit(0).then(() => ({ error: null }))
    // Use raw fetch to Supabase SQL API
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ query: sql }),
    })
    // Actually Supabase doesn't expose a raw SQL endpoint via REST easily
    // Use the pg approach but with the correct URL
    console.log('(requires direct DB access)')
    break
  }

  // Alternative: use Supabase's management API
  console.log('\nApplying via Supabase JS rpc fallback...')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const combinedSql = `
    CREATE TABLE IF NOT EXISTS meta_ad_level_insights (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      ad_id TEXT NOT NULL, ad_name TEXT, adset_id TEXT, adset_name TEXT,
      campaign_id TEXT, campaign_name TEXT, date DATE NOT NULL,
      spend NUMERIC DEFAULT 0, impressions INTEGER DEFAULT 0, reach INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0, leads INTEGER DEFAULT 0,
      synced_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(client_id, ad_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_mali_client_date ON meta_ad_level_insights(client_id, date DESC);
    CREATE INDEX IF NOT EXISTS idx_mali_ad_name ON meta_ad_level_insights(ad_name);
    CREATE TABLE IF NOT EXISTS meta_ad_statuses (
      ad_id TEXT NOT NULL, client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      ad_name TEXT, adset_id TEXT, adset_name TEXT, campaign_id TEXT, campaign_name TEXT,
      status TEXT, effective_status TEXT, updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (ad_id, client_id)
    );
    CREATE INDEX IF NOT EXISTS idx_mas_client ON meta_ad_statuses(client_id);
  `

  const r = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: combinedSql }),
  })
  const body = await r.text()
  if (r.ok) {
    console.log('✅ Migration applied via RPC')
  } else {
    console.log(`RPC failed (${r.status}): ${body}`)
    console.log('\nSQL to run manually in Supabase dashboard SQL editor:')
    console.log(combinedSql)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
