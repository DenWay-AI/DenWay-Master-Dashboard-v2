import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const supabase = createServerClient()
  let query = supabase
    .from('fathom_calls')
    .select(`
      id, recording_id, title, started_at, ended_at, duration_seconds,
      participants, has_transcript, fathom_url, category, category_override,
      synced_at, b2b_tracker_id,
      b2b_sales_tracker (
        id, lead_name, company_name, email, show_status, call_outcome,
        closer, deposit, cash_collected, contract_value, lead_quality_score, objection
      )
    `)
    .order('started_at', { ascending: false })
    .limit(500)

  if (category) query = query.eq('category', category)
  if (from) query = query.gte('started_at', from)
  if (to) query = query.lte('started_at', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
