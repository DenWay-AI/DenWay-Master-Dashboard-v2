/**
 * clearData.ts
 *
 * Clears all API-sourced data tables so a full backfill can be run cleanly.
 * NEVER touches: clients, reps, user_profiles, oauth_tokens, accounts.
 *
 * Usage:
 *   npx tsx scripts/clearData.ts            # dry run (shows counts, no delete)
 *   npx tsx scripts/clearData.ts --confirm  # actually deletes
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TABLES = [
  'sync_run_items',
  'sync_runs',
  'meta_ad_snapshots',
  'calls',
  'b2b_sales_tracker',
  'appointments',
]

const confirm = process.argv.includes('--confirm')

async function main() {
  console.log(confirm ? '🗑  CLEARING DATA TABLES' : '👀 DRY RUN — pass --confirm to actually delete\n')

  for (const table of TABLES) {
    const { count, error: countErr } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (countErr) {
      console.error(`  ❌ ${table}: count error — ${countErr.message}`)
      continue
    }

    if (!confirm) {
      console.log(`  ${table}: ${count} rows (would delete)`)
      continue
    }

    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      console.error(`  ❌ ${table}: delete error — ${error.message}`)
    } else {
      console.log(`  ✅ ${table}: deleted ${count} rows`)
    }
  }

  if (!confirm) {
    console.log('\nRun with --confirm to execute.')
  } else {
    console.log('\n✅ Done. Database is clean — run syncAll to backfill.')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
