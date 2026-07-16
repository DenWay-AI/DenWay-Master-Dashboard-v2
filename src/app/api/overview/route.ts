import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function div(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den === 0) return null
  return num / den
}

function pct(num: number | null, den: number | null): number | null {
  return div(num, den)
}

export async function GET(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')
  const clientId = searchParams.get('clientId')

  const calendarIds = process.env.DENWAY_STRATEGY_CALENDAR_IDS
    ?.split(',').map(s => s.trim()).filter(Boolean) ?? []
  const denwayLocationId = process.env.DENWAY_GHL_LOCATION_ID

  // Look up DenWay's client id
  let denwayClientId: string | null = null
  if (denwayLocationId) {
    const { data: dc } = await supabase
      .from('clients').select('id').eq('ghl_location_id', denwayLocationId).single()
    denwayClientId = dc?.id ?? null
  }

  const fromStr = from ?? '2020-01-01'
  const toStr   = to   ? to + 'T23:59:59' : new Date().toISOString()
  const toDate  = to   ?? new Date().toISOString().split('T')[0]

  // ── B2B: strategy session appointments ───────────────────────────
  const b2bApptPromise = calendarIds.length > 0
    ? supabase
        .from('appointments')
        .select('status, outcome, consultation_outcome, scheduled_at, ghl_contact_id')
        .in('ghl_calendar_id', calendarIds)
        .gte('scheduled_at', fromStr)
        .lte('scheduled_at', toStr)
    : Promise.resolve({ data: [] as any[], error: null })

  // ── B2B: DenWay's own Meta ad spend ──────────────────────────────
  const b2bMetaPromise = denwayClientId
    ? supabase
        .from('meta_ad_snapshots')
        .select('spend, leads')
        .eq('client_id', denwayClientId)
        .gte('date', fromStr.split('T')[0])
        .lte('date', toDate)
    : Promise.resolve({ data: [] as any[], error: null })

  // ── B2B: all clients for MRR / LTV / churn ────────────────────────
  const allClientsPromise = supabase
    .from('clients')
    .select('id, status, monthly_retainer_usd, enrollment_fee, created_at')

  // ── B2B: new clients in date range ───────────────────────────────
  const newClientsPromise = supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', fromStr)
    .lte('created_at', toStr)

  // ── B2C: appointments ─────────────────────────────────────────────
  let b2cApptQ = supabase
    .from('appointments')
    .select('status, outcome, consultation_outcome')
    .not('airtable_record_id', 'is', null)
    .gte('scheduled_at', fromStr)
    .lte('scheduled_at', toStr)
  if (clientId) b2cApptQ = b2cApptQ.eq('client_id', clientId)

  // ── B2C: Meta spend ───────────────────────────────────────────────
  let b2cMetaQ = supabase
    .from('meta_ad_snapshots')
    .select('spend, leads')
    .gte('date', fromStr.split('T')[0])
    .lte('date', toDate)
  if (clientId) {
    b2cMetaQ = b2cMetaQ.eq('client_id', clientId)
  } else if (denwayClientId) {
    // Exclude DenWay's own spend from B2C totals
    b2cMetaQ = b2cMetaQ.neq('client_id', denwayClientId)
  }

  const [
    b2bApptRes, b2bMetaRes, allClientsRes, newClientsRes,
    b2cApptRes, b2cMetaRes,
  ] = await Promise.all([
    b2bApptPromise, b2bMetaPromise, allClientsPromise, newClientsPromise,
    b2cApptQ, b2cMetaQ,
  ])

  // ── B2B metric calculations ───────────────────────────────────────
  const b2bAppts  = b2bApptRes.data  ?? []
  const b2bMeta   = b2bMetaRes.data  ?? []
  const allClients = allClientsRes.data ?? []

  const b2bBooked   = b2bAppts.filter(a => ['booked','confirmed','completed','rescheduled'].includes(a.status ?? '')).length
  const b2bShowed   = b2bAppts.filter(a => a.outcome === 'showed').length
  const b2bClosed   = b2bAppts.filter(a => a.consultation_outcome === 'Started Treatment').length
  const b2bPipeline = b2bAppts.filter(a =>
    a.outcome === 'showed' &&
    (a.consultation_outcome === null || a.consultation_outcome === 'Pending Treatment')
  ).length

  const b2bSpend = b2bMeta.reduce((s, m) => s + (Number(m.spend) || 0), 0) || null
  const b2bLeads = b2bMeta.reduce((s, m) => s + (Number(m.leads) || 0), 0) || null

  // Avg days from first session → 'Started Treatment' session, per contact
  const contactMap = new Map<string, { first: Date; close: Date | null }>()
  for (const a of b2bAppts) {
    if (!a.ghl_contact_id || !a.scheduled_at) continue
    const dt  = new Date(a.scheduled_at)
    const rec = contactMap.get(a.ghl_contact_id)
    if (!rec) {
      contactMap.set(a.ghl_contact_id, {
        first: dt,
        close: a.consultation_outcome === 'Started Treatment' ? dt : null,
      })
    } else {
      if (dt < rec.first) rec.first = dt
      if (a.consultation_outcome === 'Started Treatment' && (!rec.close || dt < rec.close)) {
        rec.close = dt
      }
    }
  }
  const daysArr: number[] = []
  for (const { first, close } of Array.from(contactMap.values())) {
    if (close) daysArr.push(Math.max(0, (close.getTime() - first.getTime()) / 86400000))
  }
  const b2bAvgDaysToClose = daysArr.length > 0
    ? Math.round(daysArr.reduce((a, b) => a + b, 0) / daysArr.length)
    : null

  // MRR: sum of active client retainers (snapshot, ignores date range)
  const mrr = allClients
    .filter(c => c.status === 'active')
    .reduce((s, c) => s + (Number(c.monthly_retainer_usd) || 0), 0) || null

  // LTV: avg estimated lifetime value per client
  const ltvValues = allClients
    .filter(c => ['active', 'churned'].includes(c.status ?? '') && Number(c.monthly_retainer_usd) > 0)
    .map(c => {
      const months = c.created_at
        ? Math.max(1, (Date.now() - new Date(c.created_at).getTime()) / (86400000 * 30))
        : 1
      return (Number(c.enrollment_fee) || 0) + (Number(c.monthly_retainer_usd) || 0) * months
    })
  const b2bLtv = ltvValues.length > 0
    ? Math.round(ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length)
    : null

  // Churn rate: lifetime snapshot
  const totalClients   = allClients.length
  const churnedClients = allClients.filter(c => c.status === 'churned').length
  const churnRate      = totalClients > 0 ? churnedClients / totalClients : null

  const b2bNewClients = newClientsRes.count ?? 0

  // ── B2C metric calculations ───────────────────────────────────────
  const b2cAppts = b2cApptRes.data ?? []
  const b2cMeta  = b2cMetaRes.data ?? []

  const b2cBooked = b2cAppts.filter(a => ['booked','confirmed','completed','rescheduled'].includes(a.status ?? '')).length
  const b2cShowed = b2cAppts.filter(a => a.outcome === 'showed').length
  const b2cClosed = b2cAppts.filter(a => a.consultation_outcome === 'Started Treatment').length
  const b2cSpend  = b2cMeta.reduce((s, m) => s + (Number(m.spend) || 0), 0) || null
  const b2cLeads  = b2cMeta.reduce((s, m) => s + (Number(m.leads) || 0), 0) || null

  return NextResponse.json({
    b2b: {
      adSpend:        b2bSpend,
      leads:          b2bLeads,
      booked:         b2bBooked,
      showed:         b2bShowed,
      closed:         b2bClosed,
      pipeline:       b2bPipeline,
      cpl:            div(b2bSpend, b2bLeads),
      cpb:            div(b2bSpend, b2bBooked  || null),
      cps:            div(b2bSpend, b2bShowed  || null),
      cac:            div(b2bSpend, b2bClosed  || null),
      leadToBooking:  pct(b2bBooked  || null, b2bLeads),
      bookingToShow:  pct(b2bShowed  || null, b2bBooked || null),
      showToClose:    pct(b2bClosed  || null, b2bShowed || null),
      mrr,
      ltv:            b2bLtv,
      churnRate,
      newClients:     b2bNewClients,
      avgDaysToClose: b2bAvgDaysToClose,
    },
    b2c: {
      adSpend:       b2cSpend,
      leads:         b2cLeads,
      booked:        b2cBooked,
      showed:        b2cShowed,
      closed:        b2cClosed,
      cpl:           div(b2cSpend, b2cLeads),
      cpb:           div(b2cSpend, b2cBooked || null),
      cps:           div(b2cSpend, b2cShowed || null),
      cpc:           div(b2cSpend, b2cClosed || null),
      leadToBooking: pct(b2cBooked || null, b2cLeads),
      bookingToShow: pct(b2cShowed || null, b2cBooked || null),
      showToClose:   pct(b2cClosed || null, b2cShowed || null),
    },
  })
}
