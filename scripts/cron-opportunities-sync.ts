import { config } from 'dotenv'
config({ path: '.env.local' })
import { syncB2bOpportunities } from '../src/lib/sync/ghlOpportunitiesSync'

async function main() {
  console.log('[opportunities-sync] Starting...')
  const result = await syncB2bOpportunities()
  console.log(`[opportunities-sync] Done in ${result.durationMs}ms`)
  console.log(`  Fetched:  ${result.fetched}`)
  console.log(`  Upserted: ${result.upserted}`)
  if (result.errors.length) {
    console.warn(`  Errors (${result.errors.length}):`)
    result.errors.forEach(e => console.warn(`    ${e}`))
  }
  process.exit(result.errors.length > 0 ? 1 : 0)
}

main().catch(e => { console.error('[opportunities-sync] Fatal:', e); process.exit(1) })
