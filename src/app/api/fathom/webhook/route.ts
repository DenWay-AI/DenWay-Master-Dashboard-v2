import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Fathom sends { event: 'newMeeting', data: { ... } }
    const call = body.data ?? body
    const recording_id = call.id ?? call.recording_id
    if (!recording_id) {
      return NextResponse.json({ error: 'No recording_id in payload' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { error } = await supabase.from('fathom_calls').upsert(
      {
        recording_id,
        title: call.title ?? null,
        started_at: call.started_at ?? call.created_at ?? null,
        ended_at: call.ended_at ?? null,
        duration_seconds: call.duration_seconds ?? null,
        participants: call.calendar_invitees ?? null,
        fathom_url: call.url ?? call.share_url ?? null,
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'recording_id' }
    )

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
