/**
 * B2B GHL appointment cron runner.
 * Runs once and exits — schedule via pm2 cron_restart or system crontab.
 *
 * Usage:
 *   npx tsx scripts/cron-b2b-sync.ts               # sync last 30 days
 *   npx tsx scripts/cron-b2b-sync.ts --days=730    # historical backfill (2 years)
 *
 * pm2 (nightly at 02:00 Copenhagen = 01:00 UTC):
 *   pm2 start "npx tsx scripts/cron-b2b-sync.ts" --name "b2b-sync-cron" --cron "0 1 * * *" --no-autorestart
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { syncB2bAppointments } from '../src/lib/sync/b2bGhlSync'

async function main() {
  const daysArg = process.argv.find(a => a.startsWith('--days='))
  const daysBack = daysArg ? parseInt(daysArg.split('=')[1], 10) : 30

  console.log(`[b2b-sync] Starting — daysBack=${daysBack}`)

  const result = await syncB2bAppointments({ daysBack, daysForward: 14 })

  console.log(`[b2b-sync] Done in ${result.durationMs}ms`)
  console.log(`  Calendars: ${result.calendarsProcessed}`)
  console.log(`  Events found: ${result.eventsFound}`)
  console.log(`  Upserted: ${result.upserted}`)
  if (result.errors.length) {
    console.warn(`  Errors (${result.errors.length}):`)
    result.errors.forEach(e => console.warn(`    ${e}`))
  }

  process.exit(result.errors.length > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('[b2b-sync] Fatal:', e)
  process.exit(1)
})
