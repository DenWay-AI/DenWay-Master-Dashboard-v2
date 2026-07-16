import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const FATHOM_BASE = 'https://api.fathom.ai/external/v1'

function fathomHeaders() {
  const key = process.env.FATHOM_API_KEY
  if (!key) throw new Error('Missing FATHOM_API_KEY')
  return { 'X-Api-Key': key, 'Content-Type': 'application/json' }
}

async function fetchAllCalls(): Promise<any[]> {
  const all: any[] = []
  let cursor: string | null = null

  while (true) {
    const url = new URL(`${FATHOM_BASE}/meetings`)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url.toString(), { headers: fathomHeaders() })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Fathom API error (${res.status}): ${text}`)
    }

    const data = await res.json()
    const items = data.items ?? []
    all.push(...items)

    cursor = data.next_cursor ?? null
    if (!cursor || items.length === 0) break
  }

  return all
}

async function fetchTranscript(recordingId: string): Promise<any | null> {
  const res = await fetch(`${FATHOM_BASE}/recordings/${recordingId}/transcript`, {
    headers: fathomHeaders(),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.transcript ?? null
}

function mapCall(meeting: any) {
  return {
    recording_id: String(meeting.recording_id ?? meeting.id),
    title: meeting.title ?? null,
    started_at: meeting.started_at ?? meeting.created_at ?? null,
    ended_at: meeting.ended_at ?? null,
    duration_seconds: meeting.duration_seconds ?? null,
    participants: meeting.calendar_invitees ?? null,
    fathom_url: meeting.url ?? meeting.share_url ?? null,
    synced_at: new Date().toISOString(),
  }
}

export async function POST() {
  try {
    const supabase = createServerClient()

    // Fetch all calls from Fathom
    const calls = await fetchAllCalls()
    if (calls.length === 0) {
      return NextResponse.json({ inserted: 0, transcriptsFetched: 0 })
    }

    // Upsert all calls (insert new, skip existing by recording_id)
    const rows = calls.map(mapCall).filter(r => r.recording_id)
    const { error: upsertErr } = await supabase
      .from('fathom_calls')
      .upsert(rows, { onConflict: 'recording_id', ignoreDuplicates: true })

    if (upsertErr) throw upsertErr

    // Fetch transcripts for rows that don't have one yet
    const { data: missing } = await supabase
      .from('fathom_calls')
      .select('id, recording_id')
      .eq('has_transcript', false)
      .limit(50)

    let transcriptsFetched = 0
    for (const row of missing ?? []) {
      const transcript = await fetchTranscript(row.recording_id)
      if (!transcript) continue

      await supabase
        .from('fathom_calls')
        .update({ transcript, has_transcript: true, synced_at: new Date().toISOString() })
        .eq('id', row.id)

      transcriptsFetched++
    }

    return NextResponse.json({ inserted: rows.length, transcriptsFetched })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
