import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getGhlToken } from '@/lib/ghl/getToken'

export async function GET() {
  const supabase = createServerClient()

  // Get all active clients with GHL location IDs
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, ghl_location_id')
    .in('status', ['active', 'onboarding'])
    .not('ghl_location_id', 'is', null)

  if (!clients || clients.length === 0) {
    return NextResponse.json([])
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const fromDate = thirtyDaysAgo.toISOString().split('T')[0]
  const toDate = now.toISOString().split('T')[0]

  // Get last sync per client
  const { data: syncRuns } = await supabase
    .from('sync_runs')
    .select('message, finished_at, status')
    .eq('status', 'success')
    .order('finished_at', { ascending: false })
    .limit(1)

  const lastSync = syncRuns?.[0]?.finished_at ?? null

  // DB count per client for the last 30 days
  const { data: apptCounts } = await supabase
    .from('appointments')
    .select('client_id')
    .gte('scheduled_at', thirtyDaysAgo.toISOString())
    .lte('scheduled_at', now.toISOString())
    .is('airtable_record_id', null) // GHL appointments only

  const dbCountByClient: Record<string, number> = {}
  for (const a of apptCounts ?? []) {
    if (a.client_id) {
      dbCountByClient[a.client_id] = (dbCountByClient[a.client_id] ?? 0) + 1
    }
  }

  const results = await Promise.allSettled(
    clients.map(async (client) => {
      const dbCount = dbCountByClient[client.id] ?? 0

      // Try to get GHL count via API
      let ghlCount: number | null = null
      let hasToken = false

      try {
        const token = await getGhlToken(client.id)
        hasToken = true

        // Fetch calendars, then count appointments across all calendars
        const calRes = await fetch(
          `https://services.leadconnectorhq.com/calendars/?locationId=${client.ghl_location_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Version: '2021-04-15',
            },
          }
        )
        if (calRes.ok) {
          const calData = await calRes.json()
          const calendars: any[] = calData.calendars ?? calData.data ?? []

          let total = 0
          for (const cal of calendars) {
            const startMs = thirtyDaysAgo.getTime()
            const endMs = now.getTime()
            const evtRes = await fetch(
              `https://services.leadconnectorhq.com/calendars/events?locationId=${client.ghl_location_id}&calendarId=${cal.id}&startTime=${startMs}&endTime=${endMs}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Version: '2021-04-15',
                },
              }
            )
            if (evtRes.ok) {
              const evtData = await evtRes.json()
              const events: any[] = evtData.events ?? evtData.data ?? []
              total += events.length
            }
          }
          ghlCount = total
        }
      } catch {
        // No token or API error — still return DB count
      }

      const delta = ghlCount !== null ? Math.abs(ghlCount - dbCount) : null
      const deltaPercent = ghlCount !== null && ghlCount > 0 ? delta! / ghlCount : null

      let verifyStatus: 'ok' | 'warning' | 'mismatch' | 'no_token' | 'unknown' = 'unknown'
      if (!hasToken) verifyStatus = 'no_token'
      else if (ghlCount === null) verifyStatus = 'unknown'
      else if (deltaPercent === 0) verifyStatus = 'ok'
      else if (deltaPercent !== null && deltaPercent <= 0.05) verifyStatus = 'warning'
      else verifyStatus = 'mismatch'

      return {
        clientId: client.id,
        clientName: client.name,
        dbCount,
        ghlCount,
        delta,
        verifyStatus,
        lastSync,
        period: `${fromDate} → ${toDate}`,
      }
    })
  )

  const data = results.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { error: (r as PromiseRejectedResult).reason?.message }
  )

  return NextResponse.json(data)
}
