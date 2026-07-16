import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DENWAY_GHL_LOCATION_ID } from '@/config/env'

export const dynamic = 'force-dynamic'

function safe(n: number | null | undefined): number { return Number(n) || 0 }
function div(a: number, b: number): number | null { return b > 0 ? a / b : null }

export async function GET(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')
  const clientId = searchParams.get('clientId')
  const scope    = searchParams.get('scope') // 'b2b' = DenWay only, 'b2c' = exclude DenWay

  // Resolve DenWay's client_id for scope filtering
  let denwayClientId: string | null = null
  if (scope === 'b2b' || scope === 'b2c') {
    const denwayLocationId = DENWAY_GHL_LOCATION_ID
    if (denwayLocationId) {
      const { data } = await supabase
        .from('clients')
        .select('id')
        .eq('ghl_location_id', denwayLocationId)
        .single()
      denwayClientId = data?.id ?? null
    }
  }

  let query = supabase
    .from('meta_ad_snapshots')
    .select('client_id, date, spend, impressions, reach, frequency, clicks, leads, ctr, clients(name)')
    .order('date', { ascending: false })

  if (from)     query = query.gte('date', from)
  if (to)       query = query.lte('date', to)
  if (clientId) query = query.eq('client_id', clientId)

  if (scope === 'b2b' && denwayClientId) {
    query = query.eq('client_id', denwayClientId)
  } else if (scope === 'b2c' && denwayClientId) {
    query = query.neq('client_id', denwayClientId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []

  // ── Totals ──────────────────────────────────────────────────────────────────
  const spend       = rows.reduce((s, r) => s + safe(r.spend), 0)
  const impressions = rows.reduce((s, r) => s + safe(r.impressions), 0)
  const reach       = rows.reduce((s, r) => s + safe(r.reach), 0)
  const clicks      = rows.reduce((s, r) => s + safe(r.clicks), 0)
  const leads       = rows.reduce((s, r) => s + safe(r.leads), 0)

  // Weighted avg CTR and frequency
  const ctr       = impressions > 0 ? (clicks / impressions) * 100 : null
  const frequency = reach > 0 ? impressions / reach : null
  const cpm       = div(spend * 1000, impressions)
  const cpc       = div(spend, clicks)
  const cpl       = div(spend, leads)
  const leadCvr   = impressions > 0 ? (leads / impressions) * 100 : null

  const totals = { spend, impressions, reach, frequency, clicks, ctr, cpm, cpc, leads, cpl, leadCvr }

  // ── Table rows ───────────────────────────────────────────────────────────────
  // If specific client → group by date; otherwise → group by client
  let tableRows: Record<string, any>[] = []

  if (clientId) {
    // Date-level rows (already ordered by date desc)
    tableRows = rows.map(r => {
      const s  = safe(r.spend)
      const im = safe(r.impressions)
      const rc = safe(r.reach)
      const cl = safe(r.clicks)
      const le = safe(r.leads)
      return {
        label:       r.date,
        spend:       s,
        impressions: im,
        reach:       rc,
        frequency:   rc > 0 ? im / rc : null,
        clicks:      cl,
        ctr:         im > 0 ? (cl / im) * 100 : null,
        cpm:         div(s * 1000, im),
        cpc:         div(s, cl),
        leads:       le,
        cpl:         div(s, le),
        leadCvr:     im > 0 ? (le / im) * 100 : null,
      }
    })
  } else {
    // Client-level aggregation
    const byClient = new Map<string, { name: string; spend: number; impressions: number; reach: number; clicks: number; leads: number }>()
    for (const r of rows) {
      const name = (r.clients as any)?.name ?? r.client_id
      const existing = byClient.get(r.client_id)
      if (!existing) {
        byClient.set(r.client_id, { name, spend: safe(r.spend), impressions: safe(r.impressions), reach: safe(r.reach), clicks: safe(r.clicks), leads: safe(r.leads) })
      } else {
        existing.spend       += safe(r.spend)
        existing.impressions += safe(r.impressions)
        existing.reach       += safe(r.reach)
        existing.clicks      += safe(r.clicks)
        existing.leads       += safe(r.leads)
      }
    }
    tableRows = Array.from(byClient.values())
      .sort((a, b) => b.spend - a.spend)
      .map(c => ({
        label:       c.name,
        spend:       c.spend,
        impressions: c.impressions,
        reach:       c.reach,
        frequency:   c.reach > 0 ? c.impressions / c.reach : null,
        clicks:      c.clicks,
        ctr:         c.impressions > 0 ? (c.clicks / c.impressions) * 100 : null,
        cpm:         div(c.spend * 1000, c.impressions),
        cpc:         div(c.spend, c.clicks),
        leads:       c.leads,
        cpl:         div(c.spend, c.leads),
        leadCvr:     c.impressions > 0 ? (c.leads / c.impressions) * 100 : null,
      }))
  }

  return NextResponse.json({ totals, rows: tableRows })
}
