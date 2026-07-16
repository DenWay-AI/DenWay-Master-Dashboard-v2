import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  // ── CLIENTS ──────────────────────────────────────────────────────
  const { data: allClients } = await supabase.from('clients').select('*')
  const clients = allClients ?? []

  console.log('═══ CLIENTS (' + clients.length + ' total) ═══')

  // Duplicate GHL location IDs
  const ghlIds = clients.filter(c => c.ghl_location_id).map(c => c.ghl_location_id)
  const ghlDupes = ghlIds.filter((id, i) => ghlIds.indexOf(id) !== i)
  console.log('Duplicate GHL location IDs:', ghlDupes.length ? ghlDupes : 'none')

  // Duplicate names
  const names = clients.map(c => c.name)
  const nameDupes = names.filter((n, i) => names.indexOf(n) !== i)
  console.log('Duplicate names:', nameDupes.length ? nameDupes : 'none')

  // Clients without GHL (can't sync)
  const noGhl = clients.filter(c => !c.ghl_location_id)
  console.log('\nClients WITHOUT GHL location ID (' + noGhl.length + '):')
  noGhl.forEach(c => console.log('  -', c.name, '|', c.status, '|', c.country ?? 'no country'))

  // Status breakdown
  const statusMap: Record<string, number> = {}
  clients.forEach(c => { statusMap[c.status] = (statusMap[c.status] ?? 0) + 1 })
  console.log('\nStatus breakdown:', statusMap)

  // Country breakdown
  const countryMap: Record<string, number> = {}
  clients.forEach(c => { const k = c.country ?? 'unknown'; countryMap[k] = (countryMap[k] ?? 0) + 1 })
  console.log('Country breakdown:', countryMap)

  // Key field coverage
  const withOwnerEmail = clients.filter(c => c.owner_email).length
  const withPhone = clients.filter(c => c.owner_phone).length
  const withDefcon = clients.filter(c => c.defcon_status).length
  const withCloser = clients.filter(c => c.closer_name).length
  const withPaymentPlan = clients.filter(c => c.payment_plan).length
  console.log('\nField coverage (out of', clients.length, '):')
  console.log('  owner_email:', withOwnerEmail)
  console.log('  owner_phone:', withPhone)
  console.log('  defcon_status:', withDefcon)
  console.log('  closer_name:', withCloser)
  console.log('  payment_plan:', withPaymentPlan)

  // ── APPOINTMENTS ─────────────────────────────────────────────────
  const { data: allAppts } = await supabase.from('appointments').select('*')
  const appts = allAppts ?? []

  console.log('\n═══ APPOINTMENTS (' + appts.length + ' total) ═══')

  // Source split
  const fromGHL = appts.filter(a => a.ghl_appointment_id)
  const fromAT = appts.filter(a => a.airtable_record_id)
  const bothSources = appts.filter(a => a.ghl_appointment_id && a.airtable_record_id)
  console.log('From GHL:', fromGHL.length)
  console.log('From Airtable:', fromAT.length)
  console.log('From BOTH (linked):', bothSources.length)

  // Duplicate ghl_appointment_id
  const ghlApptIds = fromGHL.map(a => a.ghl_appointment_id)
  const apptDupes = ghlApptIds.filter((id, i) => ghlApptIds.indexOf(id) !== i)
  console.log('Duplicate ghl_appointment_id:', apptDupes.length ? apptDupes.slice(0, 5) : 'none')

  // Duplicate airtable_record_id
  const atApptIds = fromAT.map(a => a.airtable_record_id)
  const atDupes = atApptIds.filter((id, i) => atApptIds.indexOf(id) !== i)
  console.log('Duplicate airtable_record_id:', atDupes.length ? atDupes.slice(0, 5) : 'none')

  // Appointments with no client (orphaned)
  const clientIdSet = new Set(clients.map(c => c.id))
  const orphaned = appts.filter(a => !clientIdSet.has(a.client_id))
  console.log('Orphaned appointments (no matching client):', orphaned.length)

  // Status + outcome breakdown
  const statusBreakdown: Record<string, number> = {}
  appts.forEach(a => { statusBreakdown[a.status] = (statusBreakdown[a.status] ?? 0) + 1 })
  console.log('Status breakdown:', statusBreakdown)

  const outcomeBreakdown: Record<string, number> = {}
  appts.forEach(a => { outcomeBreakdown[a.outcome ?? 'null'] = (outcomeBreakdown[a.outcome ?? 'null'] ?? 0) + 1 })
  console.log('Outcome breakdown:', outcomeBreakdown)

  // Consultation outcome breakdown (Airtable-sourced)
  const coBreakdown: Record<string, number> = {}
  fromAT.forEach(a => { const k = a.consultation_outcome ?? 'null'; coBreakdown[k] = (coBreakdown[k] ?? 0) + 1 })
  console.log('Consultation outcome (Airtable appts):', coBreakdown)

  // Date range of GHL appointments
  const sortedGhl = fromGHL.map(a => a.scheduled_at).sort()
  if (sortedGhl.length) {
    console.log('GHL date range:', sortedGhl[0]?.slice(0,10), '→', sortedGhl[sortedGhl.length-1]?.slice(0,10))
  }

  // ── REPS ─────────────────────────────────────────────────────────
  const { data: reps } = await supabase.from('reps').select('*')
  console.log('\n═══ REPS (' + (reps?.length ?? 0) + ' total) ═══')
  reps?.forEach(r => console.log('  -', r.name, '|', r.ghl_user_id ? 'has GHL user ID' : 'NO GHL user ID'))

  // ── SYNC RUNS ────────────────────────────────────────────────────
  const { data: syncRuns } = await supabase.from('sync_runs').select('*').order('started_at', { ascending: false }).limit(5)
  console.log('\n═══ RECENT SYNC RUNS ═══')
  syncRuns?.forEach(r => console.log('  -', r.provider, '|', r.status, '|', r.message?.slice(0, 60) ?? '-'))

  // ── CLIENTS WITH NO APPOINTMENTS ─────────────────────────────────
  const clientsWithAppts = new Set(appts.map(a => a.client_id))
  const noAppts = clients.filter(c => !clientsWithAppts.has(c.id))
  console.log('\n═══ CLIENTS WITH NO APPOINTMENTS (' + noAppts.length + ') ═══')
  noAppts.forEach(c => console.log('  -', c.name, '|', c.status))
}

main().catch(e => { console.error(e); process.exit(1) })
