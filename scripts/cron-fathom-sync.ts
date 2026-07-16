/**
 * Fathom recording sync cron runner.
 * Runs once and exits — schedule via pm2 cron_restart or system crontab.
 *
 * Usage:
 *   npx tsx scripts/cron-fathom-sync.ts
 *
 * pm2 (nightly at 02:30 Copenhagen = 01:30 UTC, after GHL sync):
 *   pm2 start "npx tsx scripts/cron-fathom-sync.ts" --name "fathom-sync-cron" --cron "30 1 * * *" --no-autorestart
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { syncFathomRecordings } from '../src/lib/sync/fathomSync'

async function main() {
  console.log('[fathom-sync] Starting...')
  const result = await syncFathomRecordings()
  console.log(`[fathom-sync] Done in ${result.durationMs}ms`)
  console.log(`  Meetings fetched:    ${result.meetingsFetched}`)
  console.log(`  Sales calls found:   ${result.salesCallsFound}`)
  console.log(`  Newly linked:        ${result.linked}`)
  console.log(`  Already linked:      ${result.alreadyLinked}`)
  console.log(`  No match found:      ${result.noMatch}`)
  console.log(`  Stored unmatched:    ${result.created}  ← visible on /meetings as "Unmatched"`)
  if (result.errors.length) {
    console.warn(`  Errors (${result.errors.length}):`)
    result.errors.forEach(e => console.warn(`    ${e}`))
  }
  process.exit(result.errors.length > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('[fathom-sync] Fatal:', e)
  process.exit(1)
})
