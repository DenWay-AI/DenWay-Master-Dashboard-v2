import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const AIRTABLE_PAT = process.env.AIRTABLE_B2B_PAT!
const BASE_ID = 'app1ffIFIQqd6spdp'
const TABLE_ID = 'tblNK5SfnIzcFaAyU'

interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
}

async function fetchAllRecords(): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = []
  let offset: string | undefined

  while (true) {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`)
    if (offset) url.searchParams.set('offset', offset)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Airtable error ${res.status}: ${err}`)
    }

    const data = await res.json()
    records.push(...data.records)

    if (!data.offset) break
    offset = data.offset
  }

  return records
}

function mapRecord(r: AirtableRecord) {
  const f = r.fields
  return {
    airtable_record_id: r.id,
    lead_name: (f['Lead Name'] as string) ?? null,
    company_name: (f['Company Name'] as string) ?? null,
    owner_role: (f['Owner / Role'] as string) ?? null,
    email: (f['Email'] as string) ?? null,
    phone: (f['Phone'] as string) ?? null,
    city: (f['City / Area'] as string) ?? null,
    country: (f['Country'] as string) ?? null,
    annual_rev: (f['Annual Rev'] as string) ?? null,
    website: (f['Website'] as string) ?? null,
    date_booked: (f['Date Appointment Booked'] as string) ?? null,
    appointment_date: (f['Appointment Date'] as string) ?? null,
    show_status: (f['Show Status'] as string) ?? null,
    qualified: (f['Qualified / Not Qualified'] as string) ?? null,
    lead_quality_score: (f['Lead Quality Score'] as number) ?? null,
    call_outcome: (f['Call Outcome'] as string) ?? null,
    deposit: (f['Deposit?'] as boolean) ?? false,
    cash_collected: (f['Cash Collected'] as number) ?? null,
    contract_value: (f['Contract Value'] as number) ?? null,
    offer: (f['Offer / Pitch'] as string) ?? null,
    notes: (f['Notes'] as string) ?? null,
    objection: (f['Objection'] as string) ?? null,
    closer: (f['Closer'] as string) ?? null,
    set_type: (f['Set Type'] as string) ?? null,
    ad_name: (f['Ad Name'] as string) ?? null,
    ad_set_name: (f['Ad Set Name'] as string) ?? null,
    campaign_name: (f['Campaign Name'] as string) ?? null,
    month_key: (f['Month Key'] as string) ?? null,
  }
}

// Subset of fields that exist on b2b_leads (the table /sales-tracker reads from)
function mapForLeads(r: AirtableRecord) {
  const m = mapRecord(r)
  return {
    airtable_record_id: m.airtable_record_id,
    lead_name: m.lead_name,
    company_name: m.company_name,
    email: m.email,
    phone: m.phone,
    city: m.city,
    country: m.country,
    annual_rev: m.annual_rev,
    website: m.website,
    qualified: m.qualified,
    lead_quality_score: m.lead_quality_score,
    call_outcome: m.call_outcome,
    deposit: m.deposit,
    cash_collected: m.cash_collected,
    contract_value: m.contract_value,
    offer: m.offer,
    notes: m.notes,
    objection: m.objection,
    ad_name: m.ad_name,
    ad_set_name: m.ad_set_name,
    campaign_name: m.campaign_name,
    month_key: m.month_key,
    updated_at: new Date().toISOString(),
  }
}

export async function POST() {
  try {
    const records = await fetchAllRecords()
    const mapped = records.map(mapRecord)
    const mappedLeads = records.map(mapForLeads)

    const supabase = createServerClient()
    const { error } = await supabase
      .from('b2b_sales_tracker')
      .upsert(mapped, { onConflict: 'airtable_record_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Also upsert into b2b_leads (what /sales-tracker reads). Only existing rows
    // get updated — onConflict on airtable_record_id with ignoreDuplicates=false.
    const { error: leadsErr } = await supabase
      .from('b2b_leads')
      .upsert(mappedLeads, { onConflict: 'airtable_record_id' })
    if (leadsErr) return NextResponse.json({ error: `b2b_leads: ${leadsErr.message}` }, { status: 500 })

    // Auto-match unlinked records to clients by exact company name
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')

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
            .update({ client_id: matchId, updated_at: new Date().toISOString() })
            .eq('id', row.id)
          autoLinked++
        }
      }
    }

    return NextResponse.json({ synced: mapped.length, autoLinked })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Vercel cron hits GET; reuse POST logic.
export async function GET() {
  return POST()
}
