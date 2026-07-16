import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const FATHOM_BASE = 'https://api.fathom.ai/external/v1'

async function fetchAndCacheTranscript(supabase: ReturnType<typeof createServerClient>, row: any) {
  const key = process.env.FATHOM_API_KEY
  if (!key) return row

  const res = await fetch(`${FATHOM_BASE}/recordings/${row.recording_id}/transcript`, {
    headers: { 'X-Api-Key': key },
  })
  if (!res.ok) return row

  const data = await res.json()
  const transcript = data.transcript ?? null
  if (!transcript) return row

  await supabase
    .from('fathom_calls')
    .update({ transcript, has_transcript: true, synced_at: new Date().toISOString() })
    .eq('id', row.id)

  return { ...row, transcript, has_transcript: true }
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('fathom_calls')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const row = !data.has_transcript ? await fetchAndCacheTranscript(supabase, data) : data
  return NextResponse.json(row)
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient()
  const body = await req.json()

  const VALID_CATEGORIES = ['sales_call', 'other', 'uncategorized']
  if (!body.category || !VALID_CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('fathom_calls')
    .update({ category: body.category, category_override: true })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
