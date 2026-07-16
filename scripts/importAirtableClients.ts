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

// Fetch Team Members to resolve linked record IDs → names
async function fetchTeamMemberMap(): Promise<Map<string, string>> {
  const records = await fetchAllAirtableRecords('tblaeOCdHKhjUuRvf')
  const map = new Map<string, string>()
  for (const rec of records) {
    const name = rec.fields['Team Member'] || `${rec.fields['First Name'] ?? ''} ${rec.fields['Last Name'] ?? ''}`.trim()
    if (name) map.set(rec.id, name)
  }
  return map
}

function normalizeStatus(s: string): string {
  const m: Record<string, string> = {
    active: 'active', paused: 'paused', churned: 'churned', onboarding: 'onboarding',
  }
  return m[(s || '').toLowerCase()] ?? 'active'
}

function normalizePaymentPlan(p: string): string | null {
  const s = (p || '').toLowerCase()
  if (s.includes('pay per show') || s.includes('pps')) return 'pay_per_show'
  if (s.includes('pay per patient') || s.includes('ppp')) return 'pay_per_patient'
  if (s.includes('retainer')) return 'retainer'
  if (s.includes('pif') || s.includes('paid in full')) return 'pif'
  return null
}

// Strip currency symbols, %, spaces — return null if not a valid number
function parseNumeric(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v
  const cleaned = String(v).replace(/[$%,\s]/g, '').trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function boolField(v: any): boolean | null {
  if (v === true || v === 'Yes' || v === '✅') return true
  if (v === false || v === 'No') return false
  return null
}

function resolveLinkedName(field: any, teamMap: Map<string, string>): string | null {
  if (!Array.isArray(field) || field.length === 0) return null
  return teamMap.get(field[0]) ?? null
}

async function main() {
  console.log('📥 Fetching Team Members for name resolution...')
  const teamMap = await fetchTeamMemberMap()
  console.log(`   Loaded ${teamMap.size} team members`)

  console.log('📥 Fetching Partners from Airtable...')
  const records = await fetchAllAirtableRecords('tbli9RDm4gVl9K8o3')
  console.log(`   Found ${records.length} Partners`)

  let inserted = 0
  let updated = 0
  let errors = 0

  for (const rec of records) {
    const f = rec.fields

    try {
      const row: Record<string, any> = {
        // Core
        name:                     f['Business Name'] ?? 'Unnamed',
        ghl_location_id:          f['GHL Location ID'] ?? null,
        status:                   normalizeStatus(f['Status'] ?? ''),
        airtable_record_id:       rec.id,

        // Identity
        legal_business_name:      f['Legal Business Name'] ?? null,
        owner_name:               f['Owner Name'] ?? null,
        doctor_name:              f['Doctor Name'] ?? null,
        owner_email:              f['Owner Email'] ?? null,
        owner_phone:              f['Owner Phone Number'] ?? null,
        personal_phone:           f['Personal Phone Number'] ?? null,
        front_desk_phone:         f['Front Desk Phone Number'] ?? null,
        company_email:            f['Company Email'] ?? null,
        city:                     f['Company City'] ?? null,
        business_address:         f['Business Address'] ?? null,
        state:                    f['Business State'] ?? null,
        zip_code:                 f['Zip Code'] ?? null,
        country:                  f['Ctry'] ?? null,
        area:                     f['Area'] ?? null,

        // Ops & health
        onboarding_status:        f['Onboarding Status'] ?? null,
        priority:                 f['Priority'] ?? null,
        defcon_status:            f['DEFCON STATUS'] ?? null,
        service_type:             ['DFY', 'DWY'].includes(f['DFY / DWY']) ? f['DFY / DWY'] : null,
        launched:                 typeof f['📣 LAUNCH BUTTON 📣'] === 'string'
                                    ? f['📣 LAUNCH BUTTON 📣'].includes('LAUNCHED')
                                    : false,

        // Financials
        payment_plan:             normalizePaymentPlan(f['Payment Plan'] ?? ''),
        pps_fee:                  parseNumeric(f['PPS Fee']),
        ppp_fee:                  parseNumeric(f['PPP Fee']),
        monthly_retainer_usd:     parseNumeric(f['Monthly Retainer USD / CADUSD']),
        monthly_retainer_dkk:     parseNumeric(f['Monthly Retainer DKK']),
        enrollment_fee:           parseNumeric(f['Enrollment Fee']),
        sms_fees:                 parseNumeric(f['SMS Fees']),
        currency:                 f['Currency'] ?? null,
        daily_ad_spend_agreed:    parseNumeric(f['Daily Ad Spend Agreed on - Int. OB Form']),
        date_closed:              f['Date of Closed Deal']
                                    ? new Date(f['Date of Closed Deal']).toISOString().split('T')[0]
                                    : null,

        // Team — resolve linked record IDs to names
        closer_name:              resolveLinkedName(f['Closer'], teamMap),
        csm_name:                 resolveLinkedName(f['Client Success Manager'], teamMap),
        media_buyer_name:         resolveLinkedName(f['Media Buyer'], teamMap),

        // Links & metadata
        website_url:              f['Website URL'] ?? null,
        facebook_url:             f['Facebook URL'] ?? null,
        google_drive_url:         f['Google Drive URL'] ?? null,
        time_zone:                f['Time Zone'] ?? null,
        consultation_hours:       f['Consultation Hours'] ?? null,
        offer:                    f['Offer'] ?? null,
        deal_description:         f['Deal Description'] ?? null,
        slack_channel_id:         f['Slack Channel ID'] ?? null,
        fathom_link:              f['Fathom Link from sales call'] ?? null,
        total_locations:          f['Total Locations'] ?? null,

        // Practice details
        accepts_spanish_patients: boolField(f['Accepts spanish patients?']),
        financing_options:        boolField(f['Financing options?']),

        // Onboarding checklist
        contract_signed:          boolField(f['Contract Signed?']) ?? false,
        paid:                     boolField(f['Paid?']) ?? false,
        ads_setup:                boolField(f['Ads Setup']) ?? false,
      }

      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('airtable_record_id', rec.id)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase.from('clients').update(row).eq('id', existing.id)
        if (error) throw error
        updated++
        console.log(`   ↻  ${row.name}`)
      } else {
        const { error } = await supabase.from('clients').insert(row)
        if (error) throw error
        inserted++
        console.log(`   +  ${row.name} (${row.status})`)
      }
    } catch (err) {
      errors++
      const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err)
      console.error(`   ❌ ${f['Business Name'] ?? rec.id}: ${msg}`)
    }
  }

  console.log('')
  console.log('✅ Import complete!')
  console.log(`   Inserted: ${inserted} | Updated: ${updated} | Errors: ${errors}`)

  if (errors > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
