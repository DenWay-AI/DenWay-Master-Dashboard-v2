import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DENWAY_STRATEGY_CALENDAR_IDS } from '@/config/env'

export async function GET(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')
  const clientId = searchParams.get('clientId')
  const limit    = parseInt(searchParams.get('limit') ?? '50')
  const offset   = parseInt(searchParams.get('offset') ?? '0')

  const type = searchParams.get('type') // 'b2c' | 'b2b' | null

  let query = supabase
    .from('appointments')
    .select(`
      id, scheduled_at, created_at, status, outcome,
      contact_name, contact_email, contact_phone, company_name,
      ghl_calendar_id,
      consultation_outcome, treatment_value,
      client_id, rep_id,
      clients(name, ghl_location_id),
      reps(name)
    `, { count: 'exact' })
    .order('scheduled_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (from) query = query.gte('scheduled_at', from)
  if (to)   query = query.lte('scheduled_at', to + 'T23:59:59')
  if (clientId) query = query.eq('client_id', clientId)

  const strategyIds = DENWAY_STRATEGY_CALENDAR_IDS

  if (type === 'b2c' && strategyIds.length > 0) {
    // B2C = client subaccount calendars (anything that is NOT a DenWay strategy session)
    // Includes historical records with no ghl_calendar_id (pre-GHL era)
    query = query.or(`ghl_calendar_id.is.null,ghl_calendar_id.not.in.(${strategyIds.join(',')})`)
  } else if (type === 'b2b' && strategyIds.length > 0) {
    // B2B = DenWay's own strategy session calendars
    query = query.in('ghl_calendar_id', strategyIds)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const appointments = (data ?? []).map((a: any) => ({
    id: a.id,
    scheduledAt: a.scheduled_at,
    createdAt: a.created_at,
    status: a.status,
    outcome: a.outcome,
    contactName: a.contact_name,
    contactEmail: a.contact_email,
    contactPhone: a.contact_phone,
    companyName: a.company_name,
    ghlCalendarId: a.ghl_calendar_id,
    consultationOutcome: a.consultation_outcome,
    treatmentValue: a.treatment_value,
    client: a.clients?.name ?? null,
    rep: a.reps?.name ?? null,
  }))

  return NextResponse.json({ appointments, total: count ?? 0 })
}
