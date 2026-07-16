import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const clientId = searchParams.get('clientId')

  // Fetch reps
  const { data: reps, error: repsError } = await supabase
    .from('reps')
    .select('id, name')
  if (repsError) return NextResponse.json({ error: repsError.message }, { status: 500 })

  // Fetch appointments with rep_id
  let query = supabase
    .from('appointments')
    .select('rep_id, status, outcome')
    .not('rep_id', 'is', null)

  if (from) query = query.gte('scheduled_at', from)
  if (to)   query = query.lte('scheduled_at', to + 'T23:59:59')
  if (clientId) query = query.eq('client_id', clientId)

  const { data: appts, error: apptError } = await query
  if (apptError) return NextResponse.json({ error: apptError.message }, { status: 500 })

  const repMap = new Map((reps ?? []).map(r => [r.id, r.name]))

  // Group by rep
  const byRep = new Map<string, { booked: number; showed: number; noShow: number; cancelled: number }>()

  for (const a of appts ?? []) {
    if (!a.rep_id) continue
    const cur = byRep.get(a.rep_id) ?? { booked: 0, showed: 0, noShow: 0, cancelled: 0 }
    if (['booked','confirmed','completed','rescheduled'].includes(a.status)) cur.booked++
    if (a.status === 'cancelled') cur.cancelled++
    if (a.outcome === 'showed') cur.showed++
    if (a.outcome === 'no_show') cur.noShow++
    byRep.set(a.rep_id, cur)
  }

  const leaderboard = Array.from(byRep.entries())
    .map(([repId, stats]) => ({
      repId,
      repName: repMap.get(repId) ?? 'Unknown',
      ...stats,
      showRate: stats.showed + stats.noShow > 0
        ? stats.showed / (stats.showed + stats.noShow)
        : null,
    }))
    .sort((a, b) => b.booked - a.booked)

  return NextResponse.json(leaderboard)
}
