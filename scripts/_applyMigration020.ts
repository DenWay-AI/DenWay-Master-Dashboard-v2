import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

async function main() {
  const { error } = await sb.rpc('query', {
    sql: 'ALTER TABLE b2b_sales_tracker ADD COLUMN IF NOT EXISTS fathom_url text;',
  })
  if (error) {
    // rpc won't work for DDL — use the pg connection directly via fetch
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
      { method: 'GET', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY! } },
    )
    console.log('Supabase REST reachable:', res.status)
    console.log('Cannot apply DDL via REST — use Supabase SQL editor or supabase CLI:')
    console.log('  ALTER TABLE b2b_sales_tracker ADD COLUMN IF NOT EXISTS fathom_url text;')
    return
  }
  console.log('Migration 020 applied.')
}

main().catch(console.error)
