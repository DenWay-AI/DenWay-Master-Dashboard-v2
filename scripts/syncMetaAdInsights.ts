/**
 * Sync Meta ad-level daily insights + current ad statuses.
 *
 * Pulls data at the individual ad level (campaign → adset → ad) so the
 * B2B ads breakdown page can show spend, impressions, clicks, and Meta-reported
 * leads per ad per day.
 *
 * Also refreshes meta_ad_statuses so the page can group ads as active vs past.
 *
 * Incremental: fetches from 2 days before the latest row to catch retroactive updates.
 * First run: 90 days.
 *
 * Usage:
 *   npx tsx scripts/syncMetaAdInsights.ts
 *   npx tsx scripts/syncMetaAdInsights.ts --days=30
 *   npx tsx scripts/syncMetaAdInsights.ts --clientId=<uuid>
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const META_BASE          = 'https://graph.facebook.com/v19.0'
const DEFAULT_LOOKBACK   = 90
const OVERLAP_DAYS       = 2
const RATE_LIMIT_MS      = 600
const ADS_PER_PAGE       = 500
const INSIGHTS_LIMIT     = 500

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const parsed: Record<string, string> = {}
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [k, v] = arg.slice(2).split('=')
      if (k && v) parsed[k] = v
    }
  }
  return { clientId: parsed.clientId ?? null, days: parsed.days ? parseInt(parsed.days) : null }
}

// ── Meta helpers ──────────────────────────────────────────────────────────────

async function metaGet(path: string, params: Record<string, string>, token: string): Promise<any> {
  const url = new URL(`${META_BASE}/${path}`)
  url.searchParams.set('access_token', token)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res  = await fetch(url.toString())
  const body = await res.json()
  if (!res.ok || body.error) {
    const e = body.error ?? { message: `HTTP ${res.status}` }
    throw new Error(`Meta [${e.code ?? res.status}] ${e.message}`)
  }
  return body
}

function extractLeads(actions: any[]): number {
  const a = (actions ?? []).find(
    (a: any) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped'
  )
  return a ? parseInt(a.value ?? '0', 10) : 0
}

// ── Ad-level insights ─────────────────────────────────────────────────────────

interface AdInsight {
  adId: string; adName: string
  adsetId: string; adsetName: string
  campaignId: string; campaignName: string
  date: string
  spend: number; impressions: number; reach: number; clicks: number; leads: number
}

async function fetchAdInsights(
  adAccountId: string, since: string, until: string, token: string
): Promise<AdInsight[]> {
  const results: AdInsight[] = []
  let cursor: string | null = null

  do {
    const params: Record<string, string> = {
      level: 'ad',
      fields: 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,date_start,spend,impressions,reach,clicks,actions',
      time_increment: '1',
      time_range: JSON.stringify({ since, until }),
      limit: String(INSIGHTS_LIMIT),
    }
    if (cursor) params.after = cursor

    const data = await metaGet(`${adAccountId}/insights`, params, token)

    for (const r of (data.data ?? [])) {
      results.push({
        adId: r.ad_id, adName: r.ad_name ?? '',
        adsetId: r.adset_id ?? '', adsetName: r.adset_name ?? '',
        campaignId: r.campaign_id ?? '', campaignName: r.campaign_name ?? '',
        date: r.date_start,
        spend: parseFloat(r.spend ?? '0'),
        impressions: parseInt(r.impressions ?? '0', 10),
        reach: parseInt(r.reach ?? '0', 10),
        clicks: parseInt(r.clicks ?? '0', 10),
        leads: extractLeads(r.actions ?? []),
      })
    }

    cursor = data.paging?.cursors?.after && data.paging?.next ? data.paging.cursors.after : null
  } while (cursor)

  return results
}

// ── Ad statuses ───────────────────────────────────────────────────────────────

interface AdStatus {
  adId: string; adName: string
  adsetId: string; adsetName: string
  campaignId: string; campaignName: string
  status: string; effectiveStatus: string
}

async function fetchAdStatuses(adAccountId: string, token: string): Promise<AdStatus[]> {
  const results: AdStatus[] = []
  let cursor: string | null = null

  do {
    const params: Record<string, string> = {
      fields: 'id,name,status,effective_status,adset_id,campaign_id',
      limit: String(ADS_PER_PAGE),
    }
    if (cursor) params.after = cursor

    const data = await metaGet(`${adAccountId}/ads`, params, token)

    for (const r of (data.data ?? [])) {
      results.push({
        adId: r.id, adName: r.name ?? '',
        adsetId: r.adset_id ?? '', adsetName: '',
        campaignId: r.campaign_id ?? '', campaignName: '',
        status: r.status ?? '', effectiveStatus: r.effective_status ?? '',
      })
    }

    cursor = data.paging?.cursors?.after && data.paging?.next ? data.paging.cursors.after : null
  } while (cursor)

  return results
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function toDateStr(d: Date): string { return d.toISOString().split('T')[0] }
function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); return toDateStr(d)
}

// ── Per-client sync ───────────────────────────────────────────────────────────

async function syncClient(
  client: { id: string; name: string; meta_ad_account_id: string },
  token: string,
  overrideDays: number | null
) {
  const { data: latest } = await supabase
    .from('meta_ad_level_insights')
    .select('date')
    .eq('client_id', client.id)
    .order('date', { ascending: false })
    .limit(1)
    .single()

  let since: string
  if (overrideDays) {
    since = daysAgo(overrideDays)
  } else if (latest?.date) {
    const d = new Date(latest.date)
    d.setDate(d.getDate() - OVERLAP_DAYS)
    since = toDateStr(d)
  } else {
    since = daysAgo(DEFAULT_LOOKBACK)
  }
  const until = toDateStr(new Date())

  console.log(`  Insights: ${since} → ${until}`)

  // Fetch insights + statuses in parallel
  const [insights, statuses] = await Promise.all([
    fetchAdInsights(client.meta_ad_account_id, since, until, token),
    fetchAdStatuses(client.meta_ad_account_id, token),
  ])

  console.log(`  ${insights.length} insight rows, ${statuses.length} ads`)

  // Build adId → {adsetName, campaignName} lookup from insights for enriching statuses
  const adMeta = new Map<string, { adsetName: string; adsetId: string; campaignName: string; campaignId: string }>()
  for (const ins of insights) {
    if (!adMeta.has(ins.adId)) {
      adMeta.set(ins.adId, {
        adsetName: ins.adsetName, adsetId: ins.adsetId,
        campaignName: ins.campaignName, campaignId: ins.campaignId,
      })
    }
  }

  // Upsert insights
  if (insights.length > 0) {
    const rows = insights.map(ins => ({
      client_id: client.id,
      ad_id: ins.adId, ad_name: ins.adName,
      adset_id: ins.adsetId, adset_name: ins.adsetName,
      campaign_id: ins.campaignId, campaign_name: ins.campaignName,
      date: ins.date,
      spend: ins.spend, impressions: ins.impressions, reach: ins.reach,
      clicks: ins.clicks, leads: ins.leads,
      synced_at: new Date().toISOString(),
    }))
    const { error } = await supabase
      .from('meta_ad_level_insights')
      .upsert(rows, { onConflict: 'client_id,ad_id,date' })
    if (error) throw new Error(`Insights upsert: ${error.message}`)
  }

  // Upsert statuses
  if (statuses.length > 0) {
    const statusRows = statuses.map(s => {
      const meta = adMeta.get(s.adId)
      return {
        ad_id: s.adId, client_id: client.id,
        ad_name: s.adName,
        adset_id: meta?.adsetId ?? s.adsetId,
        adset_name: meta?.adsetName ?? '',
        campaign_id: meta?.campaignId ?? s.campaignId,
        campaign_name: meta?.campaignName ?? '',
        status: s.status,
        effective_status: s.effectiveStatus,
        updated_at: new Date().toISOString(),
      }
    })
    const { error } = await supabase
      .from('meta_ad_statuses')
      .upsert(statusRows, { onConflict: 'ad_id,client_id' })
    if (error) throw new Error(`Statuses upsert: ${error.message}`)
  }

  return { insightRows: insights.length, adStatuses: statuses.length }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { clientId: filterClientId, days: overrideDays } = parseArgs()

  const token = process.env.META_ACCESS_TOKEN
  if (!token) { console.error('❌ Missing META_ACCESS_TOKEN'); process.exit(1) }

  let query = supabase
    .from('clients')
    .select('id, name, meta_ad_account_id')
    .not('meta_ad_account_id', 'is', null)
    .in('status', ['active', 'onboarding'])

  if (filterClientId) query = query.eq('id', filterClientId) as typeof query

  const { data: clients, error } = await query
  if (error) throw error

  if (!clients?.length) {
    console.log('No clients with meta_ad_account_id. Set it in Settings → Client.')
    return
  }

  console.log(`🔄 Syncing Meta ad-level insights for ${clients.length} client(s)…\n`)

  let failed = 0
  for (const client of clients) {
    console.log(`→ ${client.name} (${client.meta_ad_account_id})`)
    try {
      const { insightRows, adStatuses } = await syncClient(
        client as { id: string; name: string; meta_ad_account_id: string },
        token, overrideDays
      )
      console.log(`  ✅ ${insightRows} insight rows, ${adStatuses} ad statuses`)
    } catch (e: any) {
      console.error(`  ❌ ${e.message}`)
      failed++
    }
    await sleep(RATE_LIMIT_MS)
  }

  console.log(`\n✅ Done — ${failed} client(s) failed`)
}

main().catch(e => { console.error(e); process.exit(1) })
