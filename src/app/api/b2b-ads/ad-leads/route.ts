import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[_\s\-–]+/g, ' ').trim()
}

export async function GET(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const adName = searchParams.get('adName') ?? ''
  const from   = searchParams.get('from') ?? ''
  const to     = searchParams.get('to')   ?? ''

  const normTarget = norm(adName)

  const [contactsRes, salesRes] = await Promise.all([
    // All contacts in date range — filter by ad_name in JS for normalised match
    supabase
      .from('b2b_contacts')
      .select('id,full_name,first_name,last_name,company_name,email,phone,date_added,ad_name,campaign_name,ad_set_name,utm_source,pipeline_stage,opportunity_status,opportunity_monetary_value,opportunity_created_at')
      .gte('date_added', from)
      .lte('date_added', to + 'T23:59:59Z')
      .order('date_added', { ascending: false }),

    // All sales tracker records in date range
    supabase
      .from('b2b_sales_tracker')
      .select('id,lead_name,company_name,email,ad_name,ad_set_name,campaign_name,date_booked,appointment_date,show_status,qualified,call_outcome,cash_collected,contract_value,lead_quality_score,closer,notes,fathom_url')
      .gte('date_booked', from)
      .lte('date_booked', to + 'T23:59:59Z')
      .order('date_booked', { ascending: false }),
  ])

  if (contactsRes.error) return NextResponse.json({ error: contactsRes.error.message }, { status: 500 })
  if (salesRes.error)    return NextResponse.json({ error: salesRes.error.message },    { status: 500 })

  const contacts = (contactsRes.data ?? []).filter(c => norm(c.ad_name) === normTarget)

  // Build an email set from matched contacts — used as a fallback join for sales records
  // that were GHL-synced before UTM attribution was added (ad_name = NULL on those rows).
  const contactEmailSet = new Set(contacts.map(c => c.email).filter(Boolean))

  const allSales = salesRes.data ?? []

  // Attribute records: ad_name match (primary) OR email match (fallback for GHL records without ad_name)
  const attributed = allSales.filter(s =>
    norm(s.ad_name) === normTarget ||
    (s.email && contactEmailSet.has(s.email))
  )

  // Deduplicate by lead email — same logic as the breakdown metric.
  // Keep the record with the highest-ranked outcome per unique lead.
  // If no email, fall back to lead_name; treat blanks as distinct.
  const OUTCOME_RANK: Record<string, number> = { Closed: 4, 'No Sale': 3, 'Follow-up': 2, Unqualified: 1 }
  const byLead = new Map<string, typeof attributed[number]>()

  for (const s of attributed) {
    const leadKey = s.email?.toLowerCase().trim() || s.lead_name?.toLowerCase().trim() || s.id
    const existing = byLead.get(leadKey)
    if (!existing) {
      byLead.set(leadKey, s)
    } else {
      const newRank = OUTCOME_RANK[s.call_outcome ?? ''] ?? 0
      const oldRank = OUTCOME_RANK[existing.call_outcome ?? ''] ?? 0
      // Prefer the higher-ranked outcome; on tie, prefer more recent booking
      if (newRank > oldRank || (newRank === oldRank && (s.date_booked ?? '') > (existing.date_booked ?? ''))) {
        byLead.set(leadKey, s)
      }
    }
  }

  const sales = Array.from(byLead.values()).sort((a, b) =>
    (b.date_booked ?? '').localeCompare(a.date_booked ?? '')
  )

  return NextResponse.json({ contacts, sales })
}
