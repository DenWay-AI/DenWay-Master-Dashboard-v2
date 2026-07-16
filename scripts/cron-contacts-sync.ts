import { config } from 'dotenv'
config({ path: '.env.local' })
import { syncB2bContacts } from '../src/lib/sync/ghlContactsSync'

async function main() {
  console.log('[contacts-sync] Starting...')
  const result = await syncB2bContacts()
  console.log(`[contacts-sync] Done in ${result.durationMs}ms`)
  console.log(`  Fetched:  ${result.fetched}`)
  console.log(`  Upserted: ${result.upserted}`)
  if (result.errors.length) {
    console.warn(`  Errors (${result.errors.length}):`)
    result.errors.forEach(e => console.warn(`    ${e}`))
  }
  process.exit(result.errors.length > 0 ? 1 : 0)
}

main().catch(e => { console.error('[contacts-sync] Fatal:', e); process.exit(1) })
