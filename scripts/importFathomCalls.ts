/**
 * importFathomCalls.ts
 *
 * Imports DenWay B2B Fathom sales calls from Airtable into b2b_sales_tracker.
 * Equivalent to POST /api/sync/airtable-booked-calls but runs standalone.
 *
 * Usage:
 *   npx tsx scripts/importFathomCalls.ts            # dry run
 *   npx tsx scripts/importFathomCalls.ts --confirm  # write to DB
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const AIRTABLE_PAT = process.env.AIRTABLE_B2B_PAT!
const BASE_ID = 'app1ffIFIQqd6spdp'
const TABLE_ID = 'tblNK5SfnIzcFaAyU'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRY_RUN = !process.argv.includes('--confirm')

async function fetchAllRecords() {
  const records: any[] = []
  let offset: string | undefined

  while (true) {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`)
    if (offset) url.searchParams.set('offset', offset)
    url.searchParams.set('pageSize', '100')

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
    })
    if (!res.ok) throw new Error(`Airtable error ${res.status}: ${await res.text()}`)
    const data = await res.json()
    records.push(...data.records)
    if (!data.offset) break
    offset = data.offset
    process.stdout.write(`\r  Fetched ${records.length} records…`)
  }
  console.log(`\r  Fetched ${records.length} records total        `)
  return records
}

function mapRecord(r: any) {
  const f = r.fields
  return {
    airtable_record_id: r.id,
    lead_name:          (f['Lead Name'] as string)                    ?? null,
    company_name:       (f['Company Name'] as string)                 ?? null,
    owner_role:         (f['Owner / Role'] as string)                 ?? null,
    email:              (f['Email'] as string)                        ?? null,
    phone:              (f['Phone'] as string)                        ?? null,
    city:               (f['City / Area'] as string)                  ?? null,
    country:            (f['Country'] as string)                      ?? null,
    annual_rev:         (f['Annual Rev'] as string)                   ?? null,
    website:            (f['Website'] as string)                      ?? null,
    date_booked:        (f['Date Appointment Booked'] as string)      ?? null,
    appointment_date:   (f['Appointment Date'] as string)             ?? null,
    show_status:        (f['Show Status'] as string)                  ?? null,
    qualified:          (f['Qualified / Not Qualified'] as string)    ?? null,
    lead_quality_score: (f['Lead Quality Score'] as number)           ?? null,
    call_outcome:       (f['Call Outcome'] as string)                 ?? null,
    deposit:            (f['Deposit?'] as boolean)                    ?? false,
    cash_collected:     (f['Cash Collected'] as number)               ?? null,
    contract_value:     (f['Contract Value'] as number)               ?? null,
    offer:              (f['Offer / Pitch'] as string)                ?? null,
    notes:              (f['Notes'] as string)                        ?? null,
    objection:          (f['Objection'] as string)                    ?? null,
    closer:             (f['Closer'] as string)                       ?? null,
    set_type:           (f['Set Type'] as string)                     ?? null,
    ad_name:            (f['Ad Name'] as string)                      ?? null,
    ad_set_name:        (f['Ad Set Name'] as string)                  ?? null,
    campaign_name:      (f['Campaign Name'] as string)                ?? null,
    month_key:          (f['Month Key'] as string)                    ?? null,
  }
}

async function main() {
  console.log(DRY_RUN
    ? '👀 DRY RUN — pass --confirm to write\n'
    : '✍️  WRITING TO DB\n'
  )

  if (!AIRTABLE_PAT) {
    console.error('Missing AIRTABLE_B2B_PAT in .env.local')
    process.exit(1)
  }

  const records = await fetchAllRecords()
  const mapped = records.map(mapRecord)

  console.log(`\n  Mapped ${mapped.length} records`)

  // Show sample
  const withOutcome = mapped.filter(r => r.call_outcome || r.show_status)
  const withEmail   = mapped.filter(r => r.email)
  console.log(`  With call outcome: ${withOutcome.length}`)
  console.log(`  With email:        ${withEmail.length}`)

  if (DRY_RUN) {
    console.log('\n  Sample (first 5):')
    mapped.slice(0, 5).forEach(r =>
      console.log(`    ${r.lead_name ?? '?'} | ${r.company_name ?? '?'} | ${r.appointment_date ?? '?'} | ${r.show_status ?? '-'} | ${r.call_outcome ?? '-'}`)
    )
    console.log('\nRun with --confirm to upsert.')
    return
  }

  // Upsert in batches
  let upserted = 0, errors = 0
  for (let i = 0; i < mapped.length; i += 100) {
    const chunk = mapped.slice(i, i + 100)
    const { error } = await supabase
      .from('b2b_sales_tracker')
      .upsert(chunk, { onConflict: 'airtable_record_id' })
    if (error) {
      console.error(`  ❌ batch ${i}-${i + chunk.length}: ${error.message}`)
      errors++
    } else {
      upserted += chunk.length
    }
  }
  console.log(`\n  ✅ Upserted ${upserted} records, ${errors} batch errors`)

  // Auto-link to clients by company name
  const { data: clients } = await supabase.from('clients').select('id, name')
  const { data: unlinked } = await supabase
    .from('b2b_sales_tracker')
    .select('id, company_name')
    .is('client_id', null)
    .not('company_name', 'is', null)

  let autoLinked = 0
  if (clients && unlinked) {
    const clientMap = new Map(clients.map(c => [c.name.toLowerCase().trim(), c.id]))
    for (const row of unlinked) {
      const key = (row.company_name ?? '').toLowerCase().trim()
      const matchId = clientMap.get(key)
      if (matchId) {
        await supabase
          .from('b2b_sales_tracker')
          .update({ client_id: matchId })
          .eq('id', row.id)
        autoLinked++
      }
    }
  }
  console.log(`  ✅ Auto-linked ${autoLinked} records to clients by exact company name`)
  console.log('\n✅ Done.')
}

main().catch(e => { console.error(e); process.exit(1) })
