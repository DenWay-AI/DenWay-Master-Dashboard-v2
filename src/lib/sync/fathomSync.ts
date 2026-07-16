import { createClient } from '@supabase/supabase-js'

const FATHOM_BASE = 'https://api.fathom.ai/external/v1'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function getFathomKey(): string {
  const key = process.env.FATHOM_API_KEY
  if (!key) throw new Error('Missing FATHOM_API_KEY env var')
  return key
}

interface FathomMeeting {
  recording_id: number
  title: string
  url: string
  share_url: string
  recording_start_time: string
  scheduled_start_time: string
  calendar_invitees_domains_type: string
  calendar_invitees: { name: string; email: string; is_external: boolean }[]
  recorded_by: { name: string; email: string }
  duration_seconds?: number
}

async function fetchMeetingsPage(
  apiKey: string,
  cursor?: string,
): Promise<{ items: FathomMeeting[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: '100' })
  if (cursor) params.set('cursor', cursor)

  const res = await fetch(`${FATHOM_BASE}/meetings?${params}`, {
    headers: { 'X-Api-Key': apiKey },
  })
  if (!res.ok) throw new Error(`Fathom API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return { items: data.items ?? [], nextCursor: data.next_cursor ?? null }
}

async function fetchAllMeetings(apiKey: string): Promise<FathomMeeting[]> {
  const all: FathomMeeting[] = []
  let cursor: string | undefined
  do {
    const { items, nextCursor } = await fetchMeetingsPage(apiKey, cursor)
    all.push(...items)
    cursor = nextCursor ?? undefined
  } while (cursor)
  return all
}

// Extract probable lead name from meeting title
// "Rafael L Mercado × Thor | Invisalign Growth Call" → "Rafael L Mercado"
function extractLeadName(title: string): string | null {
  const crossIdx = title.indexOf('×')
  if (crossIdx > 0) return title.slice(0, crossIdx).trim()
  const ampIdx = title.indexOf('&')
  if (ampIdx > 0) return title.slice(0, ampIdx).trim()
  return null
}

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

function nameScore(a: string, b: string): number {
  const na = normName(a)
  const nb = normName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const wordsA = na.split(' ')
  const setB = new Set<string>(nb.split(' '))
  const common = wordsA.filter(w => setB.has(w) && w.length > 1).length
  return common / Math.max(wordsA.length, nb.split(' ').length)
}

export interface FathomSyncResult {
  meetingsFetched: number
  salesCallsFound: number
  linked: number
  alreadyLinked: number
  noMatch: number
  created: number
  errors: string[]
  durationMs: number
}

export async function syncFathomRecordings(): Promise<FathomSyncResult> {
  const started = Date.now()
  const supabase = getSupabase()
  const apiKey = getFathomKey()
  const errors: string[] = []

  const meetings = await fetchAllMeetings(apiKey)

  // Only consider meetings with at least one external invitee (= sales calls)
  const salesCalls = meetings.filter(
    m => m.calendar_invitees_domains_type === 'one_or_more_external'
  )

  // Load all b2b_meetings joined with lead info for matching
  const { data: dbMeetings, error: dbErr } = await supabase
    .from('b2b_meetings')
    .select('id, lead_id, scheduled_at, fathom_recording_id, fathom_url, b2b_leads(lead_name, email)')
  if (dbErr) throw new Error(`b2b_meetings fetch: ${dbErr.message}`)

  // Build set of already-synced recording IDs
  const syncedIds = new Set<string>(
    (dbMeetings ?? [])
      .filter(m => m.fathom_recording_id)
      .map(m => String(m.fathom_recording_id))
  )

  // Build date → meetings index for fast candidate lookup
  type DbMeeting = NonNullable<typeof dbMeetings>[0]
  const byDate = new Map<string, DbMeeting[]>()
  for (const m of dbMeetings ?? []) {
    if (!m.scheduled_at) continue
    const d = m.scheduled_at.slice(0, 10)
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d)!.push(m)
  }

  let linked = 0
  let alreadyLinked = 0
  let noMatch = 0
  let created = 0

  for (const call of salesCalls) {
    try {
      const recordingId = String(call.recording_id)

      // Skip if already synced
      if (syncedIds.has(recordingId)) { alreadyLinked++; continue }

      const callDate = (call.recording_start_time || call.scheduled_start_time).slice(0, 10)
      const leadFromTitle = extractLeadName(call.title)

      // Gather candidates from ±1 day (handles timezone drift)
      const candidates: DbMeeting[] = []
      for (let offset = -1; offset <= 1; offset++) {
        const d = new Date(callDate + 'T00:00:00Z')
        d.setUTCDate(d.getUTCDate() + offset)
        const key = d.toISOString().slice(0, 10)
        const rows = byDate.get(key)
        if (rows) candidates.push(...rows)
      }

      // Exclude candidates already linked to a different recording
      const available = candidates.filter(m => !m.fathom_recording_id)

      const fathomData = {
        fathom_recording_id: recordingId,
        fathom_url: call.url,
        fathom_title: call.title,
        duration_seconds: call.duration_seconds ?? null,
        updated_at: new Date().toISOString(),
      }

      if (available.length === 0) {
        // No matching GHL meeting — store as an unlinked meeting row so it
        // appears on the /meetings page and can be manually linked later
        const { error } = await supabase.from('b2b_meetings').insert({
          ...fathomData,
          lead_id: null,
          scheduled_at: call.recording_start_time || call.scheduled_start_time,
        })
        if (error) throw new Error(`unlinked insert: ${error.message}`)
        created++
        continue
      }

      // Pick best candidate by name score if multiple
      let best = available[0]
      if (available.length > 1 && leadFromTitle) {
        const scored = available.map(m => ({
          row: m,
          score: nameScore(leadFromTitle, (m.b2b_leads as any)?.lead_name ?? ''),
        }))
        scored.sort((a, b) => b.score - a.score)
        if (scored[0].score > 0.4) best = scored[0].row
      }

      const { error } = await supabase
        .from('b2b_meetings')
        .update(fathomData)
        .eq('id', best.id)
      if (error) throw new Error(`update ${best.id}: ${error.message}`)
      linked++
    } catch (e) {
      errors.push(`Recording ${call.recording_id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return {
    meetingsFetched: meetings.length,
    salesCallsFound: salesCalls.length,
    linked,
    alreadyLinked,
    noMatch,
    created,
    errors,
    durationMs: Date.now() - started,
  }
}
