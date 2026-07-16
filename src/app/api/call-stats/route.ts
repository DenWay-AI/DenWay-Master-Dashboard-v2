import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function fmtDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export async function GET(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)

  const from = searchParams.get('from') ?? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const to = searchParams.get('to') ?? new Date().toISOString().split('T')[0]
  const clientId = searchParams.get('clientId') ?? null

  const fromTs = `${from}T00:00:00.000Z`
  const toTs = `${to}T23:59:59.999Z`

  try {
    // Load all matching calls
    let query = supabase
      .from('calls')
      .select('client_id, direction, status, duration_seconds, ghl_user_id, contact_created_at, called_at, ghl_contact_id')
      .gte('called_at', fromTs)
      .lte('called_at', toTs)

    if (clientId) query = query.eq('client_id', clientId)

    const { data: calls, error } = await query
    if (error) throw error

    const rows = calls ?? []

    // Load clients for names
    const clientIdSet = Array.from(new Set(rows.map((r) => r.client_id)))
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, name')
      .in('id', clientIdSet.length > 0 ? clientIdSet : ['__none__'])

    const clientMap = new Map((clientsData ?? []).map((c: any) => [c.id, c.name]))

    // Load reps for names
    const ghlUserIds = Array.from(new Set(rows.map((r) => r.ghl_user_id).filter(Boolean)))
    const { data: repsData } = await supabase
      .from('reps')
      .select('ghl_user_id, name')
      .in('ghl_user_id', ghlUserIds.length > 0 ? ghlUserIds : ['__none__'])

    const repMap = new Map((repsData ?? []).map((r: any) => [r.ghl_user_id, r.name]))

    // ── Summary ──────────────────────────────────────────────────────────
    const totalCalls = rows.length
    const inbound = rows.filter((r) => r.direction === 'inbound').length
    const outbound = rows.filter((r) => r.direction === 'outbound').length
    const completed = rows.filter((r) => r.status === 'completed').length
    const voicemail = rows.filter((r) => r.status === 'voicemail').length
    const totalDuration = rows.reduce((s, r) => s + (r.duration_seconds ?? 0), 0)
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0

    // Speed to lead: avg seconds from contact creation to FIRST outbound call per contact
    // Only count contacts where the first call happened within 7 days (true speed-to-lead)
    const firstCallByContact = new Map<string, { calledAt: number; contactCreatedAt: number }>()
    rows
      .filter((r) => r.direction === 'outbound' && r.contact_created_at && r.called_at && r.ghl_contact_id)
      .forEach((r) => {
        const calledAt = new Date(r.called_at).getTime()
        const contactCreatedAt = new Date(r.contact_created_at!).getTime()
        const existing = firstCallByContact.get(r.ghl_contact_id!)
        if (!existing || calledAt < existing.calledAt) {
          firstCallByContact.set(r.ghl_contact_id!, { calledAt, contactCreatedAt })
        }
      })

    const fromMs = new Date(fromTs).getTime()
    const toMs = new Date(toTs).getTime()

    const speedToLeadDeltas = Array.from(firstCallByContact.values())
      .filter(({ contactCreatedAt }) => contactCreatedAt >= fromMs && contactCreatedAt <= toMs) // lead was NEW in this period
      .map(({ calledAt, contactCreatedAt }) => (calledAt - contactCreatedAt) / 1000)
      .filter((s) => s >= 0 && s <= 7 * 24 * 3600) // call happened within 7 days of creation

    const speedToLeadSeconds =
      speedToLeadDeltas.length > 0
        ? Math.round(speedToLeadDeltas.reduce((a, b) => a + b, 0) / speedToLeadDeltas.length)
        : null

    // Avg attempts per unique contact
    const contactAttempts = new Map<string, number>()
    rows.forEach((r) => {
      if (r.ghl_contact_id) {
        contactAttempts.set(r.ghl_contact_id, (contactAttempts.get(r.ghl_contact_id) ?? 0) + 1)
      }
    })
    const avgAttempts =
      contactAttempts.size > 0
        ? Math.round((rows.filter((r) => r.ghl_contact_id).length / contactAttempts.size) * 10) / 10
        : null

    const summary = {
      totalCalls,
      inbound,
      outbound,
      inboundPct: totalCalls > 0 ? Math.round((inbound / totalCalls) * 1000) / 10 : 0,
      completed,
      voicemail,
      pickupRate: totalCalls > 0 ? Math.round((completed / totalCalls) * 1000) / 10 : 0,
      voicemailPct: totalCalls > 0 ? Math.round((voicemail / totalCalls) * 1000) / 10 : 0,
      totalDurationSeconds: totalDuration,
      avgDurationSeconds: avgDuration,
      avgDurationFmt: fmtDuration(avgDuration),
      speedToLeadSeconds,
      avgAttemptsPerContact: avgAttempts,
    }

    // ── By Client ─────────────────────────────────────────────────────────
    const byClientMap = new Map<string, any>()
    rows.forEach((r) => {
      const cid = r.client_id
      if (!byClientMap.has(cid)) {
        byClientMap.set(cid, {
          clientId: cid,
          clientName: clientMap.get(cid) ?? 'Unknown',
          totalCalls: 0, inbound: 0, outbound: 0,
          completed: 0, voicemail: 0,
          totalDuration: 0,
        })
      }
      const c = byClientMap.get(cid)!
      c.totalCalls++
      if (r.direction === 'inbound') c.inbound++
      if (r.direction === 'outbound') c.outbound++
      if (r.status === 'completed') c.completed++
      if (r.status === 'voicemail') c.voicemail++
      c.totalDuration += r.duration_seconds ?? 0
    })

    const byClient = Array.from(byClientMap.values())
      .map((c) => ({
        ...c,
        avgDurationSeconds: c.totalCalls > 0 ? Math.round(c.totalDuration / c.totalCalls) : 0,
        avgDurationFmt: fmtDuration(c.totalCalls > 0 ? Math.round(c.totalDuration / c.totalCalls) : 0),
        pickupRate: c.totalCalls > 0 ? Math.round((c.completed / c.totalCalls) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls)

    // ── By Rep ────────────────────────────────────────────────────────────
    const byRepMap = new Map<string, any>()
    rows.forEach((r) => {
      if (!r.ghl_user_id) return
      const uid = r.ghl_user_id
      if (!byRepMap.has(uid)) {
        byRepMap.set(uid, {
          ghlUserId: uid,
          repName: repMap.get(uid) ?? uid,
          totalCalls: 0, inbound: 0, outbound: 0,
          completed: 0, voicemail: 0,
          totalDuration: 0,
        })
      }
      const rep = byRepMap.get(uid)!
      rep.totalCalls++
      if (r.direction === 'inbound') rep.inbound++
      if (r.direction === 'outbound') rep.outbound++
      if (r.status === 'completed') rep.completed++
      if (r.status === 'voicemail') rep.voicemail++
      rep.totalDuration += r.duration_seconds ?? 0
    })

    const byRep = Array.from(byRepMap.values())
      .map((r) => ({
        ...r,
        avgDurationSeconds: r.totalCalls > 0 ? Math.round(r.totalDuration / r.totalCalls) : 0,
        avgDurationFmt: fmtDuration(r.totalCalls > 0 ? Math.round(r.totalDuration / r.totalCalls) : 0),
        pickupRate: r.totalCalls > 0 ? Math.round((r.completed / r.totalCalls) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls)

    return NextResponse.json({ summary, byClient, byRep })
  } catch (error) {
    console.error('Error fetching call stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
