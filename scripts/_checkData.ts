import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  // Clients
  const { data: clients, error: ce } = await supabase.from('clients').select('*').limit(3)
  if (ce) { console.error('clients error:', ce.message); process.exit(1) }
  const { count: clientCount } = await supabase.from('clients').select('*', { count: 'exact', head: true })

  console.log('=== CLIENTS ===')
  console.log('Total rows:', clientCount)
  console.log('Columns:', Object.keys(clients?.[0] ?? {}).join(', '))
  clients?.forEach(c => console.log(
    ' -', c.name, '|', c.status, '|', c.country ?? 'no country',
    '|', c.payment_plan ?? 'no plan',
    '|', c.ghl_location_id ? 'has GHL' : 'NO GHL',
    '|', c.airtable_record_id ? 'has AT' : 'NO AT'
  ))

  // Status breakdown
  const { data: allClients } = await supabase.from('clients').select('status')
  const statusCounts: Record<string, number> = {}
  allClients?.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1 })
  console.log('Status breakdown:', JSON.stringify(statusCounts))

  // Clients without GHL
  const { count: noGhl } = await supabase.from('clients').select('*', { count: 'exact', head: true }).is('ghl_location_id', null)
  console.log('Clients without GHL location ID:', noGhl)

  // Appointments
  const { data: appts } = await supabase.from('appointments').select('*').limit(3)
  const { count: apptCount } = await supabase.from('appointments').select('*', { count: 'exact', head: true })

  console.log('\n=== APPOINTMENTS ===')
  console.log('Total rows:', apptCount)
  if (appts && appts.length > 0) {
    console.log('Columns:', Object.keys(appts[0]).join(', '))
    appts.forEach(a => console.log(
      ' -', a.contact_name ?? 'no name', '|', a.status, '|', a.outcome,
      '|', a.consultation_outcome ?? 'no outcome',
      '|', a.campaign_name ?? 'no campaign',
      '|', a.airtable_record_id ? 'has AT' : 'NO AT'
    ))
  }

  // Appointments from Airtable vs GHL
  const { count: atAppts } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).not('airtable_record_id', 'is', null)
  const { count: ghlAppts } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).not('ghl_appointment_id', 'is', null)
  console.log('  From Airtable:', atAppts, '| From GHL:', ghlAppts)

  // Account sources
  const { count: srcCount } = await supabase.from('account_sources').select('*', { count: 'exact', head: true })
  const { data: srcs } = await supabase.from('account_sources').select('*').limit(3)
  console.log('\n=== ACCOUNT_SOURCES ===')
  console.log('Total rows:', srcCount)
  srcs?.forEach(s => console.log(' -', s.source, '|', s.external_id, '|', 'active:', s.is_active))
}

main().catch(e => { console.error(e); process.exit(1) })
