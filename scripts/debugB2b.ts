import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await sb
    .from('appointments')
    .select('contact_name, company_name, ghl_contact_id, ghl_calendar_id, raw')
    .is('airtable_record_id', null)
    .order('scheduled_at', { ascending: false })
    .limit(3)

  data?.forEach((a, i) => {
    console.log(`\n--- Appointment ${i + 1} ---`)
    console.log('contact_name:', a.contact_name)
    console.log('company_name:', a.company_name)
    console.log('ghl_contact_id:', a.ghl_contact_id)
    console.log('ghl_calendar_id:', a.ghl_calendar_id)
    console.log('raw.contactId:', a.raw?.contactId)
    console.log('raw.contact:', JSON.stringify(a.raw?.contact))
    console.log('raw keys:', Object.keys(a.raw || {}).join(', '))
  })
}

main().catch(console.error)
