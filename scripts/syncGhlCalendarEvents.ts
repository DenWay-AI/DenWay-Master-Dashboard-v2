import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

if (!process.env.GHL_AGENCY_TOKEN && !process.env.GHL_ACCESS_TOKEN) {
  console.error('Missing GHL_AGENCY_TOKEN or GHL_ACCESS_TOKEN environment variable')
  process.exit(1)
}

const GHL_TOKEN = process.env.GHL_ACCESS_TOKEN ?? process.env.GHL_AGENCY_TOKEN!

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// CLI args schema
const cliArgsSchema = z.object({
  locationId: z.string().min(1, 'locationId is required'),
  calendarId: z.string().min(1, 'calendarId is required'),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start must be YYYY-MM-DD'),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end must be YYYY-MM-DD'),
})

type CLIArgs = z.infer<typeof cliArgsSchema>

// Parse CLI args — falls back to DENWAY_GHL_LOCATION_ID env var
function parseCLIArgs(): CLIArgs {
  const args = process.argv.slice(2)
  const parsed: Record<string, string> = {}

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=')
      if (key && value) {
        parsed[key] = value
      }
    }
  }

  if (!parsed.locationId && process.env.DENWAY_GHL_LOCATION_ID) {
    parsed.locationId = process.env.DENWAY_GHL_LOCATION_ID
  }

  const result = cliArgsSchema.safeParse(parsed)
  if (!result.success) {
    console.error('Invalid CLI arguments:')
    result.error.errors.forEach((err) => {
      console.error(`  --${err.path.join('.')}: ${err.message}`)
    })
    console.error('\nUsage: npm run sync:ghl -- --calendarId=... --start=YYYY-MM-DD --end=YYYY-MM-DD')
    console.error('       locationId falls back to DENWAY_GHL_LOCATION_ID in .env.local')
    process.exit(1)
  }

  return result.data
}

// Convert date to epoch milliseconds (UTC)
function dateToEpochMs(dateStr: string, isEnd: boolean = false): number {
  const date = new Date(dateStr + 'T00:00:00.000Z')
  if (isEnd) {
    date.setUTCHours(23, 59, 59, 999)
  }
  return date.getTime()
}

// Fetch a single page of events from GHL API
async function fetchGhlEventsPage(
  locationId: string,
  calendarId: string,
  startTime: number,
  endTime: number,
  cursor?: string,
): Promise<{ events: any[]; nextCursor: string | null }> {
  const params = new URLSearchParams({
    locationId,
    calendarId,
    startTime: String(startTime),
    endTime: String(endTime),
  })
  if (cursor) params.set('nextPageToken', cursor)

  const response = await fetch(
    `https://services.leadconnectorhq.com/calendars/events?${params}`,
    {
      method: 'GET',
      headers: {
        'Version': '2021-04-15',
        'Authorization': `Bearer ${GHL_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GHL API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  // Normalise response shape — GHL returns events under different keys
  let events: any[] = []
  if (Array.isArray(data)) {
    events = data
  } else if (Array.isArray(data.events)) {
    events = data.events
  } else if (Array.isArray(data.appointments)) {
    events = data.appointments
  } else if (Array.isArray(data.data)) {
    events = data.data
  } else {
    console.warn('Unexpected GHL API response structure, returning empty array')
  }

  // GHL pagination — nextPageToken lives at various depths
  const nextCursor: string | null =
    data?.meta?.nextPageToken ??
    data?.nextPageToken ??
    data?.meta?.startAfterId ??
    null

  return { events, nextCursor }
}

// Fetch ALL events for a calendar+date-range, walking pagination automatically
async function fetchGhlEvents(
  locationId: string,
  calendarId: string,
  startTime: number,
  endTime: number
): Promise<any[]> {
  const allEvents: any[] = []
  let cursor: string | undefined = undefined
  let page = 1

  do {
    const { events, nextCursor } = await fetchGhlEventsPage(locationId, calendarId, startTime, endTime, cursor)
    allEvents.push(...events)
    console.log(`   Page ${page}: ${events.length} events (total so far: ${allEvents.length})`)
    cursor = nextCursor ?? undefined
    page++
  } while (cursor)

  return allEvents
}

// Map GHL appointment status to our status and outcome fields
function mapGhlAppointmentStatus(ghlStatus: string): { status: string; outcome: string } {
  const normalized = (ghlStatus || '').toLowerCase().trim()
  
  // Map to status (normalized lowercase)
  let status = normalized || 'booked'
  if (!['booked', 'confirmed', 'cancelled', 'completed', 'rescheduled'].includes(status)) {
    status = 'booked'
  }
  
  // Map to outcome based on appointment status
  // Note: Schema only allows 'showed', 'no_show', or 'unknown' for outcome
  // Per requirements: confirmed => booked (mapped to unknown), cancelled => cancelled (mapped to unknown)
  let outcome = 'unknown'
  if (['confirmed'].includes(normalized)) {
    // Per requirements: confirmed => "booked", but schema doesn't allow "booked" as outcome
    // Mapping to "unknown" since confirmed appointments haven't happened yet
    outcome = 'unknown'
  } else if (['cancelled'].includes(normalized)) {
    // Per requirements: cancelled => "cancelled", but schema doesn't allow "cancelled" as outcome
    // Mapping to "unknown" since cancelled is a status, not an outcome
    outcome = 'unknown'
  } else if (['noshow', 'no_show', 'no-show'].includes(normalized)) {
    outcome = 'no_show'
  } else if (['showed', 'completed'].includes(normalized)) {
    outcome = 'showed'
  }
  
  return { status, outcome }
}

// Parse ISO date string with timezone
function parseIsoDate(dateStr: string): string {
  try {
    return new Date(dateStr).toISOString()
  } catch (error) {
    throw new Error(`Invalid date format: ${dateStr}`)
  }
}

// Fetch contact details from GHL API with caching
async function fetchGhlContact(contactId: string, contactCache: Map<string, any>): Promise<any | null> {
  if (contactCache.has(contactId)) {
    return contactCache.get(contactId)
  }
  
  const url = `https://services.leadconnectorhq.com/contacts/${contactId}`
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Version': '2021-07-28',
        'Authorization': `Bearer ${GHL_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      // Don't throw, just return null if contact fetch fails
      console.warn(`   ⚠️  Failed to fetch contact ${contactId}: ${response.status}`)
      contactCache.set(contactId, null)
      return null
    }
    
    const data = await response.json()
    const contact = data.contact ?? data
    contactCache.set(contactId, contact)
    return contact
  } catch (error) {
    console.warn(`   ⚠️  Error fetching contact ${contactId}:`, error instanceof Error ? error.message : String(error))
    contactCache.set(contactId, null)
    return null
  }
}

async function syncGhlCalendarEvents() {
  const args = parseCLIArgs()
  const syncRunId = randomUUID()

  console.log('🔄 Starting GHL calendar events sync...')
  console.log(`   Location ID: ${args.locationId}`)
  console.log(`   Calendar ID: ${args.calendarId}`)
  console.log(`   Date range: ${args.start} to ${args.end}`)

  // Create sync run record
  const { data: syncRun, error: syncRunError } = await supabase
    .from('sync_runs')
    .insert({
      id: syncRunId,
      provider: 'ghl',
      status: 'success', // Will update to failure if needed
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (syncRunError) {
    console.error('Error creating sync run:', syncRunError)
    process.exit(1)
  }

  try {
    // Convert dates to epoch milliseconds
    const startTime = dateToEpochMs(args.start, false)
    const endTime = dateToEpochMs(args.end, true)

    console.log(`   Fetching events from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`)

    // Fetch events from GHL
    const events = await fetchGhlEvents(args.locationId, args.calendarId, startTime, endTime)
    console.log(`   Fetched ${events.length} events from GHL`)

    // Find client by ghl_location_id
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('ghl_location_id', args.locationId)
      .limit(1)

    const client = clients?.[0]
    if (clientError || !client) {
      throw new Error(
        `Client not found for locationId: ${args.locationId}. ` +
        `Please ensure a client exists with ghl_location_id="${args.locationId}"`
      )
    }

    console.log(`   Found client: ${client.id}`)

    // Fetch all reps to build lookup map
    const { data: reps, error: repsError } = await supabase
      .from('reps')
      .select('id, ghl_user_id')

    if (repsError) {
      throw new Error(`Error fetching reps: ${repsError.message}`)
    }

    const repMap = new Map<string, string>()
    reps?.forEach((rep) => {
      if (rep.ghl_user_id) {
        repMap.set(rep.ghl_user_id, rep.id)
      }
    })

    console.log(`   Found ${repMap.size} reps with ghl_user_id`)

    // Contact cache for avoiding duplicate API calls
    const contactCache = new Map<string, any>()
    let contactFetchCount = 0
    let contactCacheHitCount = 0

    // Process and upsert events
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const event of events) {
      try {
        // Find rep_id if assignedUserId matches
        const repId = event.assignedUserId && repMap.has(event.assignedUserId)
          ? repMap.get(event.assignedUserId)!
          : null

        // Map appointment status to status and outcome
        const { status, outcome } = mapGhlAppointmentStatus(event.appointmentStatus || event.status || '')

        // Fetch contact details if contactId exists
        let contactName = event.contactName || event.contact?.name || null
        let contactEmail = null
        let contactPhone = null

        if (event.contactId) {
          const wasCached = contactCache.has(event.contactId)
          const contact = await fetchGhlContact(event.contactId, contactCache)
          
          if (wasCached) {
            contactCacheHitCount++
          } else {
            contactFetchCount++
          }

          if (contact) {
            contactName = contact.name || (contact.firstName && contact.lastName ? `${contact.firstName} ${contact.lastName}` : contact.firstName || contact.lastName) || contactName
            contactEmail = contact.email || null
            contactPhone = contact.phone || contact.phoneNumber || null
          }
        }

        const companyName = (() => {
          if (!event.contactId) return null
          const contact = contactCache.get(event.contactId)
          return contact?.companyName || contact?.company || null
        })()

        // Prepare appointment data
        const appointmentData = {
          ghl_appointment_id: event.id,
          ghl_calendar_id: args.calendarId,
          client_id: client.id,
          rep_id: repId,
          ghl_contact_id: event.contactId || null,
          contact_name: contactName,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          company_name: companyName,
          scheduled_at: parseIsoDate(event.startTime),
          created_at: event.dateAdded ? parseIsoDate(event.dateAdded) : new Date().toISOString(),
          status,
          outcome,
          raw: event,
        }

        // Upsert by ghl_appointment_id (unique constraint)
        const { error: upsertError } = await supabase
          .from('appointments')
          .upsert(appointmentData, {
            onConflict: 'ghl_appointment_id',
          })

        if (upsertError) {
          throw new Error(`Upsert failed: ${upsertError.message}`)
        }

        // If this is a DenWay B2B strategy calendar, also mirror to b2b_sales_tracker
        const strategyCalendarIds = (process.env.DENWAY_STRATEGY_CALENDAR_IDS ?? '')
          .split(',').map(s => s.trim()).filter(Boolean)

        if (strategyCalendarIds.includes(args.calendarId)) {
          const ghlStatus = (event.appointmentStatus || event.status || '').toLowerCase().trim()
          const salesShowStatus = (() => {
            if (['showed', 'completed'].includes(ghlStatus)) return 'Showed'
            if (['noshow', 'no_show', 'no-show'].includes(ghlStatus)) return 'No Show'
            if (['cancelled'].includes(ghlStatus)) return 'Cancelled'
            if (['rescheduled'].includes(ghlStatus)) return 'Reschedule'
            return null
          })()

          const salesRecord = {
            ghl_appointment_id: event.id,
            lead_name: contactName,
            company_name: companyName,
            email: contactEmail,
            phone: contactPhone,
            date_booked: event.dateAdded ? parseIsoDate(event.dateAdded) : new Date().toISOString(),
            appointment_date: event.startTime ? event.startTime.split('T')[0] : null,
            show_status: salesShowStatus,
          }

          const { error: salesError } = await supabase
            .from('b2b_sales_tracker')
            .upsert(salesRecord, { onConflict: 'ghl_appointment_id' })

          if (salesError) {
            console.warn(`   ⚠️  b2b_sales_tracker upsert failed for ${event.id}: ${salesError.message}`)
          }
        }

        successCount++
      } catch (error) {
        errorCount++
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(`Event ${event.id}: ${errorMsg}`)
        console.error(`   ⚠️  Error processing event ${event.id}:`, errorMsg)
      }
    }

    // Update sync run with success
    await supabase
      .from('sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'success',
        message: `Synced ${successCount} events. ${errorCount} errors.`,
      })
      .eq('id', syncRunId)

    console.log('')
    console.log('✅ Sync completed successfully!')
    console.log(`   Processed: ${events.length} events`)
    console.log(`   Success: ${successCount}`)
    console.log(`   Errors: ${errorCount}`)
    console.log(`   Contacts fetched: ${contactFetchCount}`)
    console.log(`   Contacts from cache: ${contactCacheHitCount}`)

    if (errors.length > 0) {
      console.log('')
      console.log('Error details:')
      errors.slice(0, 10).forEach((err) => console.log(`   - ${err}`))
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more errors`)
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('')
    console.error('❌ Sync failed:', errorMessage)

    // Update sync run with failure
    await supabase
      .from('sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'failure',
        message: errorMessage,
      })
      .eq('id', syncRunId)

    process.exit(1)
  }
}

syncGhlCalendarEvents().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
