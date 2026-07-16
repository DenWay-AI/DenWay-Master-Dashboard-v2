/**
 * backfillAirtable.ts
 *
 * One-time Airtable → Supabase backfill. Run AFTER clearData + syncAll.
 *
 * Pass 1 — Patch client financials from Airtable Partners → clients table
 *   Match key: Partners.GHL Location ID → clients.ghl_location_id
 *   Fields patched: enrollment_fee, cash_collected, deal_structure, monthly_retainer_usd
 *
 * Pass 2 — Patch B2C consultation outcomes onto GHL-synced appointments
 *   Match key: extract GHL contact ID from GHL Contact Link URL + parse appointment date
 *   Fields patched: outcome, consultation_outcome, treatment_value, lead_quality_score
 *
 * Usage:
 *   npx tsx scripts/backfillAirtable.ts            # dry run
 *   npx tsx scripts/backfillAirtable.ts --confirm  # write to DB
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN ?? 'patP9cEEIovK6JLn3.8e49d7e6c5b769f67eca3a5b80e73428157b87346f17ab44708c58cdbc54c0b2'
const AIRTABLE_BASE  = 'appMrZBe8XGKQVrIy'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRY_RUN = !process.argv.includes('--confirm')

// ─── Airtable helpers ────────────────────────────────────────────────────────

async function fetchAllAirtable(tableId: string, fields: string[]): Promise<any[]> {
  const qs = fields.map(f => `fields[]=${encodeURIComponent(f)}`).join('&')
  const all: any[] = []
  let offset: string | undefined

  do {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}?pageSize=100&${qs}${offset ? `&offset=${offset}` : ''}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } })
    if (!res.ok) throw new Error(`Airtable error ${res.status}: ${await res.text()}`)
    const data = await res.json()
    all.push(...data.records)
    offset = data.offset
  } while (offset)

  return all
}

// Extract GHL contact ID from a URL like:
//   https://app.gohighlevel.com/v2/location/XXX/contacts/detail/CONTACT_ID
//   https://patients.denway.co/v2/location/XXX/contacts/detail/CONTACT_ID
// Also handles corrupt formula strings by extracting from inside quotes
function extractGhlContactId(raw: string | undefined): { contactId: string; locationId: string } | null {
  if (!raw) return null

  // Handle corrupted formula like: LOWER(TRIM({...})) = LOWER(TRIM("https://..."))
  const urlMatch = raw.match(/https?:\/\/[^\s"]+/)
  const url = urlMatch ? urlMatch[0] : raw

  const m = url.match(/\/location\/([A-Za-z0-9]+)\/contacts\/detail\/([A-Za-z0-9]+)/)
  if (!m) return null
  return { locationId: m[1], contactId: m[2] }
}

// Parse Airtable text like "Monday, November 24, 2025 9:30 AM" → "2025-11-24"
function parseAppointmentDate(text: string | undefined, isoDate: string | undefined): string | null {
  if (isoDate) return isoDate.split('T')[0]
  if (!text) return null
  try {
    const d = new Date(text)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  } catch {}
  return null
}

// Map Airtable Show (Y/N) → appointments.outcome
function mapShowOutcome(val: string | undefined): string | null {
  if (!val) return null
  const v = val.toLowerCase()
  if (v.includes('show') && !v.includes('no')) return 'showed'
  if (v === 'no show' || v === 'no_show') return 'no_show'
  if (v === 'cancelled' || v === 'canceled') return 'no_show'
  return null
}

// Map Airtable Consultation Outcome → appointments.consultation_outcome
function mapConsultationOutcome(val: string | undefined): string | null {
  if (!val) return null
  if (val.includes('Started Treatment')) return 'Started Treatment'
  if (val.includes('Pending Treatment')) return 'Pending Treatment'
  if (val.includes('Did Not Start')) return 'Did Not Start Treatment'
  if (val.includes('Unqualified')) return 'Unqualified'
  return null
}

// ─── Pass 1: Patch client financials ─────────────────────────────────────────

async function patchClientFinancials() {
  console.log('\n━━━ PASS 1: Client Financials ━━━')

  const partners = await fetchAllAirtable('tbli9RDm4gVl9K8o3', [
    'Business Name', 'GHL Location ID', 'Enrollment Fee', 'Cash Collected',
    'Deal Structure', 'Monthly Retainer USD / CADUSD', 'Status', 'Date of Closed Deal',
    'PPS Fee', 'Paid To Date',
  ])

  const { data: dbClients } = await supabase.from('clients').select('id, name, ghl_location_id')
  const clientByLocation = new Map((dbClients ?? []).map(c => [c.ghl_location_id, c]))

  let matched = 0, skipped = 0, noLocation = 0

  for (const r of partners) {
    const f = r.fields
    const locationId: string | undefined = f['GHL Location ID']

    if (!locationId) { noLocation++; continue }

    const client = clientByLocation.get(locationId)
    if (!client) {
      console.log(`  ⚠ No DB client for location ${locationId} (${f['Business Name'] ?? '?'})`)
      skipped++
      continue
    }

    const patch: Record<string, any> = {}
    if (f['Enrollment Fee'])                     patch.enrollment_fee          = f['Enrollment Fee']
    if (f['Monthly Retainer USD / CADUSD'])      patch.monthly_retainer_usd    = f['Monthly Retainer USD / CADUSD']
    if (f['Date of Closed Deal'])                patch.date_closed             = f['Date of Closed Deal']
    if (f['PPS Fee'])                            patch.pps_fee                 = f['PPS Fee']
    // cash_collected, deal_structure, paid_to_date require migration 019 — skipped until columns exist

    if (Object.keys(patch).length === 0) { skipped++; continue }

    matched++
    console.log(`  ${DRY_RUN ? '[DRY]' : '✅'} ${f['Business Name'] ?? client.name} → patch: ${Object.keys(patch).join(', ')}`)

    if (!DRY_RUN) {
      const { error } = await supabase.from('clients').update(patch).eq('id', client.id)
      if (error) console.error(`    ❌ update failed: ${error.message}`)
    }
  }

  console.log(`\n  Partners total: ${partners.length} | matched: ${matched} | no location: ${noLocation} | skipped (no data): ${skipped}`)
}

// ─── Pass 2: Patch B2C consultation outcomes ─────────────────────────────────

async function patchConsultationOutcomes() {
  console.log('\n━━━ PASS 2: B2C Consultation Outcomes ━━━')

  const consultations = await fetchAllAirtable('tblWFBzvMAtKoli7s', [
    'GHL Contact Link', 'Appointment Time', 'Appointment Time (Date)',
    'Show (Y/N)', 'Consultation Outcome', 'Treatment Value', 'Lead Quality Score',
    'Company Name (from Partner)', 'Lead Name', 'Lead Email',
  ])

  // Load all appointments keyed by (ghl_contact_id, scheduled_date)
  const { data: appts } = await supabase
    .from('appointments')
    .select('id, ghl_contact_id, scheduled_at, outcome, consultation_outcome, treatment_value, lead_quality_score, client_id')

  const apptMap = new Map<string, typeof appts[0]>()
  for (const a of appts ?? []) {
    if (!a.ghl_contact_id || !a.scheduled_at) continue
    const dateKey = a.scheduled_at.split('T')[0]
    apptMap.set(`${a.ghl_contact_id}__${dateKey}`, a)
  }

  // Also build a contact-only map for fallback (when date is missing)
  const apptByContact = new Map<string, (typeof appts[0])[]>()
  for (const a of appts ?? []) {
    if (!a.ghl_contact_id) continue
    const list = apptByContact.get(a.ghl_contact_id) ?? []
    list.push(a)
    apptByContact.set(a.ghl_contact_id, list)
  }

  let matched = 0, noContact = 0, noDate = 0, noMatch = 0, noOutcome = 0, alreadySet = 0

  const report: { status: string; name: string; company: string; reason?: string }[] = []

  for (const r of consultations) {
    const f = r.fields
    const ghl = extractGhlContactId(f['GHL Contact Link'])
    const apptDate = parseAppointmentDate(f['Appointment Time'], f['Appointment Time (Date)'])
    const showOutcome = mapShowOutcome(f['Show (Y/N)'])
    const consultOutcome = mapConsultationOutcome(f['Consultation Outcome'])
    const treatmentValue: number | null = f['Treatment Value'] ?? null
    const leadQuality: number | null = f['Lead Quality Score'] ?? null

    const name = (Array.isArray(f['Lead Name']) ? f['Lead Name'][0] : f['Lead Name']) ?? '?'
    const company = (Array.isArray(f['Company Name (from Partner)']) ? f['Company Name (from Partner)'][0] : '') ?? ''

    // Skip records with no outcome data worth patching
    if (!showOutcome && !consultOutcome && !treatmentValue && !leadQuality) {
      noOutcome++
      continue
    }

    if (!ghl) {
      noContact++
      report.push({ status: '⚠ no_contact_id', name, company })
      continue
    }

    // Try exact match: contact ID + date
    let appt = apptDate ? apptMap.get(`${ghl.contactId}__${apptDate}`) : undefined

    // Fallback: contact ID only (if exactly one appointment for this contact)
    if (!appt) {
      const candidates = apptByContact.get(ghl.contactId) ?? []
      if (candidates.length === 1) {
        appt = candidates[0]
        noDate++
      } else if (candidates.length > 1) {
        noMatch++
        report.push({ status: '⚠ ambiguous', name, company, reason: `${candidates.length} appointments for contact` })
        continue
      } else {
        noMatch++
        report.push({ status: '⚠ no_match', name, company, reason: 'contact ID not in appointments table' })
        continue
      }
    }

    // Skip if all target fields already have values
    if (appt.outcome && appt.consultation_outcome && appt.treatment_value && appt.lead_quality_score) {
      alreadySet++
      continue
    }

    const patch: Record<string, any> = {}
    if (showOutcome && !appt.outcome)                   patch.outcome               = showOutcome
    if (consultOutcome && !appt.consultation_outcome)   patch.consultation_outcome  = consultOutcome
    if (treatmentValue && !appt.treatment_value)        patch.treatment_value       = treatmentValue
    if (leadQuality && !appt.lead_quality_score)        patch.lead_quality_score    = leadQuality

    if (Object.keys(patch).length === 0) { alreadySet++; continue }

    matched++
    report.push({ status: '✅ matched', name, company })
    console.log(`  ${DRY_RUN ? '[DRY]' : '✅'} ${name} (${company}) → ${Object.entries(patch).map(([k,v]) => `${k}=${v}`).join(', ')}`)

    if (!DRY_RUN) {
      const { error } = await supabase.from('appointments').update(patch).eq('id', appt.id)
      if (error) console.error(`    ❌ update failed: ${error.message}`)
    }
  }

  console.log(`
  Consultations total : ${consultations.length}
  No outcome data     : ${noOutcome} (skipped — nothing to patch)
  No contact ID       : ${noContact}
  Matched + patched   : ${matched}
  Already set         : ${alreadySet}
  Date fallback used  : ${noDate}
  No match found      : ${noMatch}
  `)

  if (noMatch > 0) {
    console.log('  Unmatched records (no GHL appointment found):')
    report.filter(r => r.status.includes('no_match') || r.status.includes('ambiguous'))
      .slice(0, 20)
      .forEach(r => console.log(`    ${r.status} | ${r.name} | ${r.company} | ${r.reason ?? ''}`))
    if (noMatch > 20) console.log(`    ... and ${noMatch - 20} more`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN
    ? '👀 DRY RUN — no writes. Pass --confirm to execute.\n'
    : '✍️  WRITING TO DB\n'
  )

  await patchClientFinancials()
  await patchConsultationOutcomes()

  console.log(DRY_RUN
    ? '\n✅ Dry run complete. Review above then run with --confirm.'
    : '\n✅ Backfill complete.'
  )
}

main().catch(e => { console.error(e); process.exit(1) })
