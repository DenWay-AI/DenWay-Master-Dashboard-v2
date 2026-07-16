/**
 * Sync Meta (Facebook) Ads metrics into meta_ad_snapshots.
 *
 * For each client with meta_ad_account_id set, fetches daily insights
 * (spend, impressions, clicks, leads) from the Meta Marketing API and
 * upserts one row per day into meta_ad_snapshots.
 *
 * Incremental: on first run fetches 90 days; on subsequent runs fetches
 * from 2 days before the latest snapshot (to catch retroactive updates).
 *
 * Usage:
 *   npx tsx scripts/syncMeta.ts
 *   npx tsx scripts/syncMeta.ts --days=30          # override lookback
 *   npx tsx scripts/syncMeta.ts --clientId=<uuid>  # single client
 *
 * Env vars required:
 *   META_ACCESS_TOKEN   — system user token with ads_read scope
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const META_BASE = 'https://graph.facebook.com/v19.0'
const DEFAULT_LOOKBACK_DAYS = 90
const OVERLAP_DAYS = 2  // re-fetch this many days before latest snapshot to catch retroactive updates
const RATE_LIMIT_SLEEP_MS = 500

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ─── CLI args ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const parsed: Record<string, string> = {}
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [k, v] = arg.slice(2).split('=')
      if (k && v) parsed[k] = v
    }
  }
  return {
    clientId: parsed.clientId ?? null,
    days: parsed.days ? parseInt(parsed.days) : null,
  }
}

// ─── Meta API helpers ────────────────────────────────────────────────────────

async function metaGet(path: string, params: Record<string, string>, token: string): Promise<any> {
  const url = new URL(`${META_BASE}/${path}`)
  url.searchParams.set('access_token', token)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString())
  const body = await res.json()

  if (!res.ok || body.error) {
    const err = body.error ?? { message: `HTTP ${res.status}` }
    throw new Error(`Meta API error [${err.code ?? res.status}] ${err.message}`)
  }

  return body
}

interface DailyInsight {
  date: string        // YYYY-MM-DD
  spend: number
  impressions: number
  reach: number
  frequency: number | null
  clicks: number
  leads: number
  ctr: number
  raw: any
}

async function fetchInsights(
  adAccountId: string,
  since: string,
  until: string,
  token: string
): Promise<DailyInsight[]> {
  const results: DailyInsight[] = []
  let nextCursor: string | null = null

  do {
    const params: Record<string, string> = {
      fields: 'date_start,spend,impressions,reach,frequency,clicks,ctr,actions',
      time_increment: '1',          // one row per day
      time_range: JSON.stringify({ since, until }),
      limit: '100',
    }
    if (nextCursor) params.after = nextCursor

    const data = await metaGet(`${adAccountId}/insights`, params, token)

    for (const row of (data.data ?? [])) {
      // Extract leads from actions array (action_type: 'lead' or 'onsite_conversion.lead_grouped')
      const actions: any[] = row.actions ?? []
      const leadAction = actions.find(
        (a) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped'
      )
      const leads = leadAction ? parseInt(leadAction.value ?? '0', 10) : 0

      results.push({
        date: row.date_start,
        spend: parseFloat(row.spend ?? '0'),
        impressions: parseInt(row.impressions ?? '0', 10),
        reach: parseInt(row.reach ?? '0', 10),
        frequency: row.frequency ? parseFloat(row.frequency) : null,
        clicks: parseInt(row.clicks ?? '0', 10),
        leads,
        ctr: parseFloat(row.ctr ?? '0'),
        raw: row,
      })
    }

    nextCursor = data.paging?.cursors?.after && data.paging?.next ? data.paging.cursors.after : null
  } while (nextCursor)

  return results
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toDateStr(d)
}

// ─── Per-client sync ──────────────────────────────────────────────────────────

async function syncClient(
  client: { id: string; name: string; meta_ad_account_id: string },
  token: string,
  overrideDays: number | null
): Promise<{ days: number; upserted: number }> {
  // Find most recent snapshot to determine since date
  const { data: latest } = await supabase
    .from('meta_ad_snapshots')
    .select('date')
    .eq('client_id', client.id)
    .order('date', { ascending: false })
    .limit(1)
    .single()

  let since: string
  if (overrideDays) {
    since = daysAgo(overrideDays)
  } else if (latest?.date) {
    // Re-fetch from OVERLAP_DAYS before last snapshot to catch retroactive changes
    const lastDate = new Date(latest.date)
    lastDate.setDate(lastDate.getDate() - OVERLAP_DAYS)
    since = toDateStr(lastDate)
  } else {
    since = daysAgo(DEFAULT_LOOKBACK_DAYS)
  }

  const until = toDateStr(new Date())

  console.log(`  Fetching ${since} → ${until}`)

  const insights = await fetchInsights(client.meta_ad_account_id, since, until, token)

  if (insights.length === 0) {
    console.log(`  No data returned from Meta`)
    return { days: 0, upserted: 0 }
  }

  // Upsert each day
  const rows = insights.map((ins) => ({
    client_id: client.id,
    date: ins.date,
    spend: ins.spend,
    impressions: ins.impressions,
    reach: ins.reach,
    frequency: ins.frequency,
    clicks: ins.clicks,
    leads: ins.leads,
    cpl: ins.leads > 0 ? ins.spend / ins.leads : null,
    ctr: ins.ctr,
    raw: ins.raw,
    synced_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('meta_ad_snapshots')
    .upsert(rows, { onConflict: 'client_id,date' })

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`)

  return { days: insights.length, upserted: rows.length }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { clientId: filterClientId, days: overrideDays } = parseArgs()

  const token = process.env.META_ACCESS_TOKEN
  if (!token) {
    console.error('❌ Missing META_ACCESS_TOKEN in .env.local')
    process.exit(1)
  }

  // Load clients with a Meta ad account ID
  let query = supabase
    .from('clients')
    .select('id, name, meta_ad_account_id')
    .not('meta_ad_account_id', 'is', null)
    .in('status', ['active', 'onboarding'])

  if (filterClientId) {
    query = query.eq('id', filterClientId) as typeof query
  }

  const { data: clients, error: clientErr } = await query
  if (clientErr) throw clientErr

  if (!clients || clients.length === 0) {
    console.log('No clients with meta_ad_account_id found. Set the field in Settings → Client → Meta Ad Account ID.')
    return
  }

  console.log(`🔄 Syncing Meta ads for ${clients.length} client(s)…\n`)

  let totalUpserted = 0
  let failed = 0

  for (const client of clients) {
    console.log(`→ ${client.name} (${client.meta_ad_account_id})`)
    try {
      const { days, upserted } = await syncClient(
        client as { id: string; name: string; meta_ad_account_id: string },
        token,
        overrideDays
      )
      console.log(`  ✅ ${upserted} days upserted (${days} from API)`)
      totalUpserted += upserted
    } catch (e: any) {
      console.error(`  ❌ ${e.message}`)
      failed++
    }

    // Respect Meta's rate limits between clients
    await sleep(RATE_LIMIT_SLEEP_MS)
  }

  console.log(`\n✅ Done — ${totalUpserted} rows upserted, ${failed} clients failed`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
