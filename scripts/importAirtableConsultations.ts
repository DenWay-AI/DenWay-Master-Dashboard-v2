import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const AIRTABLE_PAT = process.env.AIRTABLE_PAT
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID ?? 'appMrZBe8XGKQVrIy'
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!AIRTABLE_PAT) { console.error('Missing AIRTABLE_PAT in .env.local'); process.exit(1) }
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Missing Supabase env vars'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function fetchAllAirtableRecords(tableId: string): Promise<any[]> {
  const records: any[] = []
  let offset: string | undefined

  do {
    const params = new URLSearchParams({ pageSize: '100' })
    if (offset) params.set('offset', offset)

    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}?${params}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } }
    )
    if (!res.ok) throw new Error(`Airtable error (${res.status}): ${await res.text()}`)
    const data = await res.json()
    records.push(...data.records)
    offset = data.offset
  } while (offset)

  return records
}

// Build a map from Airtable Partner record ID → Supabase client ID
async function buildClientMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, airtable_record_id')
    .not('airtable_record_id', 'is', null)

  if (error) throw new Error(`Error fetching clients: ${error.message}`)

  const map = new Map<string, string>()
  for (const c of data ?? []) {
    map.set(c.airtable_record_id, c.id)
  }
  return map
}

function normalizeStatus(s: string): string {
  const m: Record<string, string> = {
    booked: 'booked', confirmed: 'confirmed', cancelled: 'cancelled',
    completed: 'completed', rescheduled: 'rescheduled',
  }
  return m[(s || '').toLowerCase()] ?? 'booked'
}

function normalizeOutcome(showYN: string): string {
  if (showYN === 'Showed') return 'showed'
  if (showYN === "Didn't Show" || showYN === 'No Show') return 'no_show'
  return 'unknown'
}

async function importTable(tableId: string, label: string, clientMap: Map<string, string>) {
  console.log(`\n📥 Fetching ${label} from Airtable...`)
  const records = await fetchAllAirtableRecords(tableId)
  console.log(`   Found ${records.length} records`)

  let inserted = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  for (const rec of records) {
    const f = rec.fields

    try {
      // Resolve client from linked Partner record
      const partnerRecordIds: string[] = f['Partner'] ?? []
      const partnerAirtableId = partnerRecordIds[0] ?? null
      const clientId = partnerAirtableId ? clientMap.get(partnerAirtableId) ?? null : null

      if (!clientId) {
        skipped++
        // Not a hard error — partner may not be in Supabase yet
        continue
      }

      // Parse appointment time
      const scheduledAt = f['Appointment Time (Date)']
        ? new Date(f['Appointment Time (Date)']).toISOString()
        : null

      if (!scheduledAt) {
        skipped++
        continue
      }

      const lookupFirst = (arr: any): string | null =>
        Array.isArray(arr) && arr.length > 0 ? String(arr[0]) : null

      const row: Record<string, any> = {
        client_id:              clientId,
        scheduled_at:           scheduledAt,
        status:                 normalizeStatus(f['Status'] ?? ''),
        outcome:                normalizeOutcome(f['Show (Y/N)'] ?? ''),

        // Contact
        contact_name:           lookupFirst(f['Lead Name']),
        contact_email:          lookupFirst(f['Lead Email']),

        // Consultation-specific
        consultation_outcome:   f['Consultation Outcome'] ?? null,
        lead_quality_score:     f['Lead Quality Score'] ?? null,
        treatment_value:        f['Treatment Value'] ?? null,
        approved_for_financing: f['Approved For Financing Plan?'] ?? null,
        unqualified_reason:     f['Unqualified Reason'] ?? null,
        appointment_notes:      f['Appointment Notes'] ?? null,
        outcome_notes:          f['Consultation Outcome Notes'] ?? null,
        is_rescheduled:         f['Rescheduled?'] === true,
        reschedule_wanted:      f['Re-Schedule Wanted?'] ?? null,
        booked_by_isa:          f['Booked by ISA'] ?? null,

        // Ad attribution
        campaign_name:          lookupFirst(f['Campaign Name (from B2C Leads)']),
        ad_set_name:            lookupFirst(f['Ad Set Name (from B2C Leads)']),
        ad_name:                lookupFirst(f['Ad Name (from B2C Leads)']),

        // Airtable tracking
        airtable_record_id:     rec.id,
      }

      const { data: existing } = await supabase
        .from('appointments')
        .select('id')
        .eq('airtable_record_id', rec.id)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from('appointments')
          .update(row)
          .eq('id', existing.id)
        if (error) throw error
        updated++
      } else {
        const { error } = await supabase
          .from('appointments')
          .insert(row)
        if (error) throw error
        inserted++
      }
    } catch (err) {
      errors++
      console.error(`   ❌ ${rec.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(`   ✅ ${label} done — inserted: ${inserted}, updated: ${updated}, skipped: ${skipped}, errors: ${errors}`)
}

async function main() {
  const clientMap = await buildClientMap()
  console.log(`   Loaded ${clientMap.size} clients from Supabase`)

  if (clientMap.size === 0) {
    console.error('No clients found. Run importAirtableClients.ts first.')
    process.exit(1)
  }

  await importTable('tblWFBzvMAtKoli7s', 'Consultations', clientMap)

  console.log('\n✅ Consultations imported!')
}

main().catch((e) => { console.error(e); process.exit(1) })
