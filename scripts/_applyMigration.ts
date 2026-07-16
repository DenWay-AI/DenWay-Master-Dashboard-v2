import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // Apply migration 019 — add missing financial columns to clients
  const sql = `
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS cash_collected  NUMERIC,
      ADD COLUMN IF NOT EXISTS deal_structure  TEXT,
      ADD COLUMN IF NOT EXISTS paid_to_date    NUMERIC;
  `

  const { error } = await sb.rpc('exec_sql' as any, { sql }).single()
  if (error) {
    // rpc not available — try direct REST
    console.log('RPC not available, trying raw SQL via postgres REST...')
    // Fall back: verify columns exist by reading a client
    const { data, error: e2 } = await sb.from('clients').select('cash_collected, deal_structure, paid_to_date').limit(1)
    if (e2) {
      console.error('Columns still missing:', e2.message)
      console.log('\nPlease run this SQL in the Supabase SQL editor:')
      console.log(sql)
    } else {
      console.log('✅ Columns already exist')
    }
    return
  }
  console.log('✅ Migration applied')
}

main().catch(e => { console.error(e); process.exit(1) })
