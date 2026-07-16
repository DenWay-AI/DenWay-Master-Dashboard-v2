import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('b2b_leads')
    .select(`
      *,
      clients(name),
      b2b_meetings(id, scheduled_at, show_status, fathom_url, closer, ghl_appointment_id)
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Compute per-lead meeting summary in JS — avoids complex SQL aggregation
  const leads = (data ?? []).map(lead => {
    const meetings: any[] = (lead.b2b_meetings ?? []).sort(
      (a: any, b: any) =>
        new Date(b.scheduled_at ?? 0).getTime() - new Date(a.scheduled_at ?? 0).getTime(),
    )
    const latest = meetings[0] ?? null
    return {
      ...lead,
      meeting_count: meetings.length,
      last_meeting_at: latest?.scheduled_at ?? null,
      last_show_status: latest?.show_status ?? null,
      last_fathom_url: latest?.fathom_url ?? null,
      last_closer: latest?.closer ?? null,
      meetings,
    }
  })

  return NextResponse.json({ leads })
}

export async function PATCH(req: Request) {
  const supabase = createServerClient()
  const body = await req.json()
  const { id, ...fields } = body

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('b2b_leads')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
