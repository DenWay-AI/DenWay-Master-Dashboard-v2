import { createClient } from '@supabase/supabase-js'

const LOCATION_ID = 'qwaeKgJBI8IG0GfFYnoa'
const GHL_API_BASE = 'https://services.leadconnectorhq.com'

// Custom field IDs → UTM keys (same as ghlContactsSync.ts)
const UTM_FIELD_MAP: Record<string, string> = {
  hXOUrLkIeXLLMTxlVFRc: 'ad_name',
  tKRWYukmP4LkZg4zcdn2: 'ad_set_name',
  pWjbZHb0zasbhPWJPXcV: 'campaign_name',
  cqAM4lZ12JlTlwqAhhPG: 'utm_source',
  YhzFNV3uPuCusqVp5b7A: 'utm_campaign',
  jsCBsljfyqPFmX3YSHfd: 'utm_content',
  '9w0lhYXeR0Al6A8wtfxj': 'utm_term',
}

function decodeUtm(contact: any): { ad_name: string | null; ad_set_name: string | null; campaign_name: string | null } {
  const raw: Record<string, string | null> = {}
  for (const f of contact?.customFields ?? []) {
    const key = UTM_FIELD_MAP[f.id]
    if (key) raw[key] = (f.value as string) ?? null
  }
  // Prefer dedicated Attribution fields; fall back to UTM params (populated by Meta tracking template).
  return {
    ad_name: raw.ad_name || raw.utm_content || null,
    ad_set_name: raw.ad_set_name || raw.utm_term || null,
    campaign_name: raw.campaign_name || raw.utm_campaign || null,
  }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function getGhlToken(): string {
  const pit = process.env.DENWAY_GHL_PIT
  if (!pit) throw new Error('Missing DENWAY_GHL_PIT env var')
  return pit
}

function getCalendarIds(): string[] {
  const ids = (process.env.DENWAY_STRATEGY_CALENDAR_IDS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean)
  if (!ids.length) throw new Error('DENWAY_STRATEGY_CALENDAR_IDS is empty')
  return ids
}

async function ghlFetch(path: string, token: string) {
  const res = await fetch(`${GHL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Version: '2021-04-15' },
  })
  if (!res.ok) throw new Error(`GHL ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function fetchEventsPage(
  calendarId: string,
  startMs: number,
  endMs: number,
  token: string,
  cursor?: string,
): Promise<{ events: any[]; nextCursor: string | null }> {
  const params = new URLSearchParams({
    locationId: LOCATION_ID,
    calendarId,
    startTime: String(startMs),
    endTime: String(endMs),
  })
  if (cursor) params.set('nextPageToken', cursor)

  const data = await ghlFetch(`/calendars/events?${params}`, token)

  const events: any[] =
    Array.isArray(data) ? data
    : Array.isArray(data.events) ? data.events
    : Array.isArray(data.appointments) ? data.appointments
    : Array.isArray(data.data) ? data.data
    : []

  const nextCursor: string | null =
    data?.meta?.nextPageToken ?? data?.nextPageToken ?? data?.meta?.startAfterId ?? null

  return { events, nextCursor }
}

async function fetchAllEvents(
  calendarId: string,
  startMs: number,
  endMs: number,
  token: string,
): Promise<any[]> {
  const all: any[] = []
  let cursor: string | undefined
  do {
    const { events, nextCursor } = await fetchEventsPage(calendarId, startMs, endMs, token, cursor)
    all.push(...events)
    cursor = nextCursor ?? undefined
  } while (cursor)
  return all
}

const contactCache = new Map<string, any>()

async function fetchContact(contactId: string, token: string): Promise<any | null> {
  if (contactCache.has(contactId)) return contactCache.get(contactId)
  try {
    const data = await ghlFetch(`/contacts/${contactId}`, token)
    const contact = data.contact ?? data
    contactCache.set(contactId, contact)
    return contact
  } catch {
    contactCache.set(contactId, null)
    return null
  }
}

function mapShowStatus(ghlStatus: string): string | null {
  const s = ghlStatus.toLowerCase().trim()
  if (['showed', 'completed'].includes(s)) return 'Showed'
  if (['noshow', 'no_show', 'no-show'].includes(s)) return 'No Show'
  if (['cancelled'].includes(s)) return 'Cancelled'
  if (['rescheduled'].includes(s)) return 'Reschedule'
  return null
}

function mapOutcome(ghlStatus: string): string {
  const s = ghlStatus.toLowerCase().trim()
  if (['noshow', 'no_show', 'no-show'].includes(s)) return 'no_show'
  if (['showed', 'completed'].includes(s)) return 'showed'
  return 'unknown'
}

export interface B2bSyncResult {
  calendarsProcessed: number
  eventsFound: number
  upserted: number
  errors: string[]
  durationMs: number
}

// Find an existing lead by ghl_contact_id, fall back to email, or create a new one.
// Never overwrites user-managed deal fields (call_outcome, qualified, etc.).
async function findOrCreateLead(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: {
    ghlContactId: string | null
    name: string | null
    email: string | null
    phone: string | null
    company: string | null
    clientId: string | null
  },
): Promise<string> {
  const { ghlContactId, name, email, phone, company, clientId } = opts

  // 1. Look up by ghl_contact_id
  if (ghlContactId) {
    const { data } = await supabase
      .from('b2b_leads')
      .select('id')
      .eq('ghl_contact_id', ghlContactId)
      .maybeSingle()
    if (data) return data.id
  }

  // 2. Fall back to email match (links migrated Airtable leads to GHL contacts)
  if (email) {
    const { data } = await supabase
      .from('b2b_leads')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (data) {
      // Backfill the ghl_contact_id so future lookups hit path 1
      if (ghlContactId) {
        await supabase
          .from('b2b_leads')
          .update({ ghl_contact_id: ghlContactId, updated_at: new Date().toISOString() })
          .eq('id', data.id)
      }
      return data.id
    }
  }

  // 3. Create new lead with contact info only — deal fields stay null for user to fill
  const { data, error } = await supabase
    .from('b2b_leads')
    .insert({
      ghl_contact_id: ghlContactId,
      lead_name: name,
      company_name: company,
      email,
      phone,
      client_id: clientId,
    })
    .select('id')
    .single()
  if (error) throw new Error(`lead insert: ${error.message}`)
  return data.id
}

// Upsert a meeting row keyed on ghl_appointment_id.
// show_status is always updated from GHL — it's meeting-level data, not user-managed.
async function upsertMeeting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: {
    ghlAppointmentId: string
    leadId: string
    scheduledAt: string
    showStatus: string | null
    closer: string | null
  },
): Promise<void> {
  const { ghlAppointmentId, leadId, scheduledAt, showStatus, closer } = opts

  const { data: existing } = await supabase
    .from('b2b_meetings')
    .select('id')
    .eq('ghl_appointment_id', ghlAppointmentId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('b2b_meetings')
      .update({
        lead_id: leadId,
        scheduled_at: scheduledAt,
        show_status: showStatus,
        closer,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) throw new Error(`meeting update: ${error.message}`)
  } else {
    const { error } = await supabase
      .from('b2b_meetings')
      .insert({
        ghl_appointment_id: ghlAppointmentId,
        lead_id: leadId,
        scheduled_at: scheduledAt,
        show_status: showStatus,
        closer,
      })
    if (error) throw new Error(`meeting insert: ${error.message}`)
  }
}

export async function syncB2bAppointments(opts?: {
  daysBack?: number
  daysForward?: number
  calendarIds?: string[]
}): Promise<B2bSyncResult> {
  const started = Date.now()
  const daysBack = opts?.daysBack ?? 30
  const daysForward = opts?.daysForward ?? 7
  const calendarIds = opts?.calendarIds ?? getCalendarIds()

  const startMs = Date.now() - daysBack * 86_400_000
  const endMs = Date.now() + daysForward * 86_400_000

  const supabase = getSupabase()
  const token = getGhlToken()

  // Get DenWay client record
  const { data: clientRows } = await supabase
    .from('clients')
    .select('id')
    .eq('ghl_location_id', LOCATION_ID)
    .limit(1)
  const clientId = clientRows?.[0]?.id ?? null

  // Build rep lookup map (ghl_user_id → name, for closer field)
  const { data: reps } = await supabase.from('reps').select('id, name, ghl_user_id')
  const repMap = new Map<string, { id: string; name: string }>()
  reps?.forEach(r => { if (r.ghl_user_id) repMap.set(r.ghl_user_id, { id: r.id, name: r.name }) })

  let eventsFound = 0
  let upserted = 0
  const errors: string[] = []

  for (const calendarId of calendarIds) {
    contactCache.clear()
    let events: any[]
    try {
      events = await fetchAllEvents(calendarId, startMs, endMs, token)
    } catch (e) {
      errors.push(`Calendar ${calendarId}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }
    eventsFound += events.length

    for (const ev of events) {
      try {
        let name = ev.contactName || ev.contact?.name || null
        let email: string | null = null
        let phone: string | null = null
        let company: string | null = null

        if (ev.contactId) {
          const contact = await fetchContact(ev.contactId, token)
          if (contact) {
            name = contact.name
              || (contact.firstName ? `${contact.firstName} ${contact.lastName ?? ''}`.trim() : null)
              || name
            email = contact.email || null
            phone = contact.phone || contact.phoneNumber || null
            company = contact.companyName || contact.company || null
          }
        }

        const ghlStatus = ev.appointmentStatus || ev.status || ''
        const repEntry = ev.assignedUserId ? repMap.get(ev.assignedUserId) : null
        const closer = repEntry?.name ?? null
        const repId = repEntry?.id ?? null

        // Keep appointments table in sync — used by B2B overview dashboard queries
        if (clientId) {
          await supabase.from('appointments').upsert({
            ghl_appointment_id: ev.id,
            ghl_calendar_id: calendarId,
            client_id: clientId,
            rep_id: repId,
            ghl_contact_id: ev.contactId || null,
            contact_name: name,
            contact_email: email,
            contact_phone: phone,
            company_name: company,
            scheduled_at: new Date(ev.startTime).toISOString(),
            status: ghlStatus || 'booked',
            outcome: mapOutcome(ghlStatus),
            raw: ev,
          }, { onConflict: 'ghl_appointment_id' })
        }

        // Find or create the lead, then upsert the meeting
        const leadId = await findOrCreateLead(supabase, {
          ghlContactId: ev.contactId || null,
          name,
          email,
          phone,
          company,
          clientId,
        })

        await upsertMeeting(supabase, {
          ghlAppointmentId: ev.id,
          leadId,
          scheduledAt: new Date(ev.startTime).toISOString(),
          showStatus: mapShowStatus(ghlStatus),
          closer,
        })

        // Mirror to b2b_sales_tracker with UTM attribution from contact custom fields.
        // We never overwrite user-managed outcome fields (qualified, call_outcome, etc.).
        // show_status is always updated since it comes from GHL appointment status.
        {
          const contact = contactCache.get(ev.contactId ?? '')
          const utm = decodeUtm(contact)
          const showStatus = mapShowStatus(ghlStatus)

          const { data: existingSales } = await supabase
            .from('b2b_sales_tracker')
            .select('id, ad_name')
            .eq('ghl_appointment_id', ev.id)
            .maybeSingle()

          if (!existingSales) {
            await supabase.from('b2b_sales_tracker').insert({
              ghl_appointment_id: ev.id,
              lead_name: name,
              company_name: company,
              email,
              phone,
              date_booked: ev.dateAdded ? new Date(ev.dateAdded).toISOString() : new Date().toISOString(),
              appointment_date: ev.startTime ? ev.startTime.split('T')[0] : null,
              show_status: showStatus,
              closer,
              ad_name: utm.ad_name,
              ad_set_name: utm.ad_set_name,
              campaign_name: utm.campaign_name,
            })
          } else {
            await supabase.from('b2b_sales_tracker')
              .update({
                show_status: showStatus,
                closer,
                // Backfill UTM if it was never set (e.g. older records from the old sync path)
                ...(existingSales.ad_name == null && utm.ad_name
                  ? { ad_name: utm.ad_name, ad_set_name: utm.ad_set_name, campaign_name: utm.campaign_name }
                  : {}),
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingSales.id)
          }
        }

        upserted++
      } catch (e) {
        errors.push(`Event ${ev.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  return {
    calendarsProcessed: calendarIds.length,
    eventsFound,
    upserted,
    errors,
    durationMs: Date.now() - started,
  }
}
