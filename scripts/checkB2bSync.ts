import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  // Recent sync runs
  const { data: runs } = await sb.from('sync_runs')
    .select('id,started_at,status,message')
    .order('started_at', { ascending: false })
    .limit(5)
  console.log('Recent sync runs:')
  runs?.forEach(r => console.log(' ', r.started_at, r.status, r.message))

  // Sync items for strategy calendars
  const calIds = ['ny6TRRNQyNgVp4mqdTAW', 'xQv7TasR6ehmGgAmV3dk', '8a9OpjsEMxWPAsmhkaqt']
  const datasets = calIds.map(id => `ghl_calendar_events:${id}`)
  const { data: items } = await sb.from('sync_run_items')
    .select('dataset,status,error_message,created_at')
    .in('dataset', datasets)
    .order('created_at', { ascending: false })
    .limit(9)
  console.log('\nStrategy calendar sync items:')
  items?.forEach(i => console.log(' ', i.created_at, i.dataset?.slice(-8), i.status, i.error_message ?? ''))

  // Latest B2B appointments in DB
  const { data: latest } = await sb.from('appointments')
    .select('scheduled_at, ghl_calendar_id')
    .in('ghl_calendar_id', calIds)
    .order('scheduled_at', { ascending: false })
    .limit(5)
  console.log('\nLatest B2B appointments in DB:')
  latest?.forEach(a => console.log(' ', a.scheduled_at, a.ghl_calendar_id))

  // Check if ANY appointments exist with those calendar IDs at all
  const { count } = await sb.from('appointments')
    .select('*', { count: 'exact', head: true })
    .in('ghl_calendar_id', calIds)
  console.log(`\nTotal B2B appointments (strategy calendars): ${count}`)
}

main().catch(console.error)
