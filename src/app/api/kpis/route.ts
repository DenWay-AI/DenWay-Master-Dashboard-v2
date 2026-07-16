import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DENWAY_STRATEGY_CALENDAR_IDS } from '@/config/env'

export async function GET(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')
  const clientId = searchParams.get('clientId')
  const type     = searchParams.get('type') // 'b2c' | 'b2b' | null

  let query = supabase
    .from('appointments')
    .select('status, outcome, treatment_value, ghl_calendar_id')

  if (from) query = query.gte('scheduled_at', from)
  if (to)   query = query.lte('scheduled_at', to + 'T23:59:59')
  if (clientId) query = query.eq('client_id', clientId)
  const strategyIds = DENWAY_STRATEGY_CALENDAR_IDS

  if (type === 'b2c' && strategyIds.length > 0) {
    query = query.or(`ghl_calendar_id.is.null,ghl_calendar_id.not.in.(${strategyIds.join(',')})`)
  } else if (type === 'b2b' && strategyIds.length > 0) {
    query = query.in('ghl_calendar_id', strategyIds)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const appts = data ?? []
  const booked    = appts.filter(a => ['booked','confirmed','completed','rescheduled'].includes(a.status)).length
  const cancelled = appts.filter(a => a.status === 'cancelled').length
  const showed    = appts.filter(a => a.outcome === 'showed').length
  const noShow    = appts.filter(a => a.outcome === 'no_show').length
  const showRate  = showed + noShow > 0 ? showed / (showed + noShow) : null
  const total     = appts.length
  const treatmentTotal = appts.reduce((sum, a) => sum + (Number(a.treatment_value) || 0), 0)

  return NextResponse.json({ total, booked, showed, noShow, showRate, cancelled, treatmentTotal })
}
