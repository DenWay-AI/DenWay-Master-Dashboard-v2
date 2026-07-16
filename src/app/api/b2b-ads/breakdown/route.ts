import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { DENWAY_GHL_LOCATION_ID } from '@/config/env'

export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawMetrics {
  spend: number; impressions: number; reach: number; clicks: number
  leads: number; booked: number; shows: number
  qualified: number; closed: number; cashCollected: number; contractRevenue: number
  // lead quality & outcome tracking (for avg + inline breakdown)
  qualitySum: number; qualityCount: number
  outcomeClosed: number; outcomeFollowUp: number; outcomeNoSale: number; outcomeUnqualified: number
}

const ZERO: RawMetrics = {
  spend: 0, impressions: 0, reach: 0, clicks: 0,
  leads: 0, booked: 0, shows: 0, qualified: 0, closed: 0,
  cashCollected: 0, contractRevenue: 0,
  qualitySum: 0, qualityCount: 0,
  outcomeClosed: 0, outcomeFollowUp: 0, outcomeNoSale: 0, outcomeUnqualified: 0,
}

function sum(rows: RawMetrics[]): RawMetrics {
  return rows.reduce((acc, r) => ({
    spend: acc.spend + r.spend,
    impressions: acc.impressions + r.impressions,
    reach: acc.reach + r.reach,
    clicks: acc.clicks + r.clicks,
    leads: acc.leads + r.leads,
    booked: acc.booked + r.booked,
    shows: acc.shows + r.shows,
    qualified: acc.qualified + r.qualified,
    closed: acc.closed + r.closed,
    cashCollected: acc.cashCollected + r.cashCollected,
    contractRevenue: acc.contractRevenue + r.contractRevenue,
    qualitySum: acc.qualitySum + r.qualitySum,
    qualityCount: acc.qualityCount + r.qualityCount,
    outcomeClosed: acc.outcomeClosed + r.outcomeClosed,
    outcomeFollowUp: acc.outcomeFollowUp + r.outcomeFollowUp,
    outcomeNoSale: acc.outcomeNoSale + r.outcomeNoSale,
    outcomeUnqualified: acc.outcomeUnqualified + r.outcomeUnqualified,
  }), { ...ZERO })
}

function div(a: number, b: number): number | null { return b > 0 ? a / b : null }

function withRatios(m: RawMetrics) {
  return {
    ...m,
    ctr:              m.impressions > 0 ? (m.clicks / m.impressions) * 100 : null,
    cpm:              div(m.spend * 1000, m.impressions),
    cpl:              div(m.spend, m.leads),
    leadToBookRate:   div(m.booked, m.leads),
    costPerBooking:   div(m.spend, m.booked),
    showRate:         div(m.shows, m.booked),
    costPerQualified: div(m.spend, m.qualified),
    closeRate:        div(m.closed, m.qualified),
    roas:             m.spend > 0 ? m.contractRevenue / m.spend : null,
    avgLeadQuality:   m.qualityCount > 0 ? m.qualitySum / m.qualityCount : null,
  }
}

// ── Ad-name normalisation (consistent across Meta / contacts / sales tracker) ─

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[_\s\-–]+/g, ' ').trim()
}

const NON_AD_NAMES = new Set(['linkinbio', 'organic', 'direct', ''])
const NON_AD_SOURCES = new Set(['link_in_bio', 'linkinbio', 'link-in-bio', 'organic', 'direct'])

function isRealAdName(name: string | null, utmSource?: string | null): boolean {
  if (!name) return false
  const n = norm(name)
  if (NON_AD_NAMES.has(n)) return false
  if (utmSource) {
    const s = norm(utmSource)
    if (NON_AD_SOURCES.has(s)) return false
  }
  return true
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? ''
  const to   = searchParams.get('to')   ?? ''

  // Resolve DenWay client_id
  let denwayClientId: string | null = null
  if (DENWAY_GHL_LOCATION_ID) {
    const { data } = await supabase
      .from('clients').select('id')
      .eq('ghl_location_id', DENWAY_GHL_LOCATION_ID).single()
    denwayClientId = data?.id ?? null
  }
  if (!denwayClientId) {
    return NextResponse.json({ error: 'DenWay client not found' }, { status: 404 })
  }

  // ── Parallel queries ────────────────────────────────────────────────────────

  const [insightsRes, contactsRes, salesRes, statusesRes, syncRes] = await Promise.all([
    // 1. Meta ad-level insights for date range
    supabase.from('meta_ad_level_insights')
      .select('ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,reach,clicks,leads')
      .eq('client_id', denwayClientId)
      .gte('date', from).lte('date', to),

    // 2. CRM contacts attributed to ads (leads)
    supabase.from('b2b_contacts')
      .select('ad_name,ad_set_name,campaign_name,utm_source,date_added')
      .gte('date_added', from).lte('date_added', to + 'T23:59:59Z'),

    // 3. Sales tracker outcomes (booked by date_booked)
    supabase.from('b2b_sales_tracker')
      .select('id,email,lead_name,ad_name,ad_set_name,campaign_name,show_status,qualified,call_outcome,cash_collected,contract_value,lead_quality_score')
      .gte('date_booked', from).lte('date_booked', to + 'T23:59:59Z'),

    // 4. Current ad statuses
    supabase.from('meta_ad_statuses')
      .select('ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,status,effective_status')
      .eq('client_id', denwayClientId),

    // 5. Last sync time
    supabase.from('meta_ad_level_insights')
      .select('synced_at').eq('client_id', denwayClientId)
      .order('synced_at', { ascending: false }).limit(1).single(),
  ])

  if (insightsRes.error) return NextResponse.json({ error: insightsRes.error.message }, { status: 500 })

  const insights  = insightsRes.data  ?? []
  const contacts  = contactsRes.data  ?? []
  const sales     = salesRes.data     ?? []
  const statuses  = statusesRes.data  ?? []
  const lastSynced = syncRes.data?.synced_at ?? null

  // ── Build per-ad maps ───────────────────────────────────────────────────────

  // key = "normCampaign::normAdset::normAd"
  type AdKey = string
  interface AdEntry {
    adId: string | null; adName: string; adsetId: string | null; adsetName: string
    campaignId: string | null; campaignName: string
    status: string | null; effectiveStatus: string | null
    raw: RawMetrics
  }

  const adMap = new Map<AdKey, AdEntry>()

  function adKey(campaign: string | null, adset: string | null, ad: string | null): AdKey {
    return `${norm(campaign)}::${norm(adset)}::${norm(ad)}`
  }

  function getOrCreate(
    k: AdKey, campaign: string, adset: string, ad: string,
    adId: string | null = null, adsetId: string | null = null, campaignId: string | null = null
  ): AdEntry {
    if (!adMap.has(k)) {
      adMap.set(k, {
        adId, adName: ad, adsetId, adsetName: adset,
        campaignId, campaignName: campaign,
        status: null, effectiveStatus: null,
        raw: { ...ZERO },
      })
    }
    const e = adMap.get(k)!
    // Prefer non-empty canonical names from Meta insights
    if (adId && !e.adId) { e.adId = adId; e.adsetId = adsetId; e.campaignId = campaignId }
    return e
  }

  // 1. Aggregate Meta insights per ad
  const metaAgg = new Map<string, RawMetrics>() // adId → summed
  for (const r of insights) {
    const existing = metaAgg.get(r.ad_id) ?? { ...ZERO }
    existing.spend       += Number(r.spend)       || 0
    existing.impressions += Number(r.impressions) || 0
    existing.reach       += Number(r.reach)       || 0
    existing.clicks      += Number(r.clicks)      || 0
    // Meta-reported leads go into a side channel; CRM leads are counted separately below
    metaAgg.set(r.ad_id, existing)
  }

  // Write Meta insights into adMap (one entry per unique adId)
  const adIdToMeta = new Map<string, { adName: string; adsetId: string; adsetName: string; campaignId: string; campaignName: string }>()
  for (const r of insights) {
    if (!adIdToMeta.has(r.ad_id)) {
      adIdToMeta.set(r.ad_id, {
        adName: r.ad_name ?? '', adsetId: r.adset_id ?? '', adsetName: r.adset_name ?? '',
        campaignId: r.campaign_id ?? '', campaignName: r.campaign_name ?? '',
      })
    }
  }
  for (const [adId, meta] of Array.from(adIdToMeta.entries())) {
    const k = adKey(meta.campaignName, meta.adsetName, meta.adName)
    const e = getOrCreate(k, meta.campaignName, meta.adsetName, meta.adName, adId, meta.adsetId, meta.campaignId)
    const m = metaAgg.get(adId) ?? { ...ZERO }
    e.raw.spend       += m.spend
    e.raw.impressions += m.impressions
    e.raw.reach       += m.reach
    e.raw.clicks      += m.clicks
  }

  // 2. Count CRM contacts (leads) per ad
  for (const c of contacts) {
    if (!isRealAdName(c.ad_name, c.utm_source)) continue
    const k = adKey(c.campaign_name, c.ad_set_name, c.ad_name)
    const e = getOrCreate(k, c.campaign_name ?? '', c.ad_set_name ?? '', c.ad_name!)
    e.raw.leads++
  }

  // 3. Aggregate sales tracker outcomes per ad — deduplicated per unique lead.
  // "Booked" = unique leads who booked, not total appointments. A lead who books
  // 3 follow-up calls with the same ad counts as 1 booked, 1 show (if any showed),
  // 1 closed (if any closed), etc. Cash sums across all their appointments.

  type LeadAgg = {
    showed: boolean; qualified: boolean; closed: boolean
    cashCollected: number; contractRevenue: number
    qualitySum: number; qualityCount: number
    bestOutcome: string
  }
  // adKey → (leadKey → aggregated lead data)
  const salesByAd = new Map<AdKey, {
    campaign: string; adset: string; adName: string
    leads: Map<string, LeadAgg>
  }>()

  for (const s of sales) {
    if (!isRealAdName(s.ad_name)) continue
    const k = adKey(s.campaign_name, s.ad_set_name, s.ad_name)
    // Identify lead by email (normalised), fall back to lead_name
    const leadKey = s.email?.toLowerCase().trim() || norm(s.lead_name) || s.id

    if (!salesByAd.has(k)) {
      salesByAd.set(k, { campaign: s.campaign_name ?? '', adset: s.ad_set_name ?? '', adName: s.ad_name!, leads: new Map() })
    }
    const adSales = salesByAd.get(k)!
    if (!adSales.leads.has(leadKey)) {
      adSales.leads.set(leadKey, { showed: false, qualified: false, closed: false, cashCollected: 0, contractRevenue: 0, qualitySum: 0, qualityCount: 0, bestOutcome: '' })
    }
    const lead = adSales.leads.get(leadKey)!
    if (s.show_status === 'Showed') lead.showed = true
    if (s.qualified === 'Yes') lead.qualified = true
    const outcome = s.call_outcome ?? ''
    if (outcome === 'Closed') {
      lead.closed = true
      lead.cashCollected   += Number(s.cash_collected)  || 0
      lead.contractRevenue += Number(s.contract_value)  || 0
    }
    const q = Number(s.lead_quality_score)
    if (q > 0) { lead.qualitySum += q; lead.qualityCount++ }
    // Track best outcome per lead (Closed wins; otherwise latest non-empty)
    const OUTCOME_RANK: Record<string, number> = { Closed: 4, 'No Sale': 3, 'Follow-up': 2, Unqualified: 1 }
    if ((OUTCOME_RANK[outcome] ?? 0) > (OUTCOME_RANK[lead.bestOutcome] ?? 0)) lead.bestOutcome = outcome
  }

  // Second pass: roll up deduplicated lead data into adMap entries
  for (const [k, adSales] of Array.from(salesByAd.entries())) {
    const e = getOrCreate(k, adSales.campaign, adSales.adset, adSales.adName)
    for (const lead of Array.from(adSales.leads.values())) {
      e.raw.booked++
      if (lead.showed)    e.raw.shows++
      if (lead.qualified) e.raw.qualified++
      if (lead.closed) {
        e.raw.closed++
        e.raw.cashCollected   += lead.cashCollected
        e.raw.contractRevenue += lead.contractRevenue
      }
      e.raw.qualitySum   += lead.qualitySum
      e.raw.qualityCount += lead.qualityCount
      const o = lead.bestOutcome
      if (o === 'Closed')       e.raw.outcomeClosed++
      else if (o === 'Follow-up')   e.raw.outcomeFollowUp++
      else if (o === 'No Sale')     e.raw.outcomeNoSale++
      else if (o === 'Unqualified') e.raw.outcomeUnqualified++
    }
  }

  // 4. Apply ad statuses
  const statusMap = new Map(statuses.map(s => [s.ad_id, s]))
  for (const [, e] of Array.from(adMap.entries())) {
    if (e.adId) {
      const st = statusMap.get(e.adId)
      if (st) {
        e.status          = st.status
        e.effectiveStatus = st.effective_status
        // Backfill campaign/adset names from status table if missing
        if (!e.campaignName && st.campaign_name) e.campaignName = st.campaign_name
        if (!e.adsetName   && st.adset_name)    e.adsetName    = st.adset_name
      }
    }
  }

  // Include active ads that have no spend in period (exist in statuses only)
  for (const st of statuses) {
    const meta = adIdToMeta.get(st.ad_id)
    const campaign = meta?.campaignName ?? st.campaign_name ?? ''
    const adset    = meta?.adsetName    ?? st.adset_name    ?? ''
    const adName   = meta?.adName       ?? st.ad_name       ?? ''
    if (!adName) continue
    const k = adKey(campaign, adset, adName)
    if (!adMap.has(k)) {
      adMap.set(k, {
        adId: st.ad_id, adName,
        adsetId: meta?.adsetId ?? st.adset_id ?? null,
        adsetName: adset, campaignId: meta?.campaignId ?? st.campaign_id ?? null,
        campaignName: campaign,
        status: st.status, effectiveStatus: st.effective_status,
        raw: { ...ZERO },
      })
    } else {
      const e = adMap.get(k)!
      if (!e.status) { e.status = st.status; e.effectiveStatus = st.effective_status }
    }
  }

  // ── Build hierarchy ─────────────────────────────────────────────────────────

  // campaign → adset → ad
  type CampaignMap = Map<string, Map<string, AdEntry[]>>
  const hierarchy: CampaignMap = new Map()

  for (const [, e] of Array.from(adMap.entries())) {
    const camp  = e.campaignName || '(no campaign)'
    const aset  = e.adsetName   || '(no ad set)'
    if (!hierarchy.has(camp)) hierarchy.set(camp, new Map())
    const asetMap = hierarchy.get(camp)!
    if (!asetMap.has(aset)) asetMap.set(aset, [])
    asetMap.get(aset)!.push(e)
  }

  function isActive(effectiveStatus: string | null): boolean {
    return effectiveStatus === 'ACTIVE'
  }

  // Serialise hierarchy into response
  const campaigns = Array.from(hierarchy.entries()).map(([campaignName, asetMap]) => {
    const adsets = Array.from(asetMap.entries()).map(([adsetName, ads]) => {
      const sortedAds = ads
        .sort((a, b) => b.raw.spend - a.raw.spend)
        .map(e => ({
          adId: e.adId, adName: e.adName,
          adsetName: e.adsetName, campaignName: e.campaignName,
          status: e.status, effectiveStatus: e.effectiveStatus,
          isActive: isActive(e.effectiveStatus),
          ...withRatios(e.raw),
        }))

      const adsetRaw = sum(ads.map(e => e.raw))
      return {
        adsetName, adsetId: ads[0]?.adsetId ?? null,
        isActive: sortedAds.some(a => a.isActive),
        ads: sortedAds,
        ...withRatios(adsetRaw),
      }
    }).sort((a, b) => (b.spend as number) - (a.spend as number))

    const campRaw  = sum(adsets.map(a => ({ ...ZERO, ...a } as unknown as RawMetrics)))
    // Re-sum raw from ads for accuracy
    const allAds   = adsets.flatMap(a => a.ads)
    const campRaw2 = sum(allAds.map(ad => ({
      spend: ad.spend, impressions: ad.impressions, reach: ad.reach, clicks: ad.clicks,
      leads: ad.leads, booked: ad.booked, shows: ad.shows, qualified: ad.qualified,
      closed: ad.closed, cashCollected: ad.cashCollected, contractRevenue: ad.contractRevenue,
      qualitySum: (ad as any).qualitySum ?? 0, qualityCount: (ad as any).qualityCount ?? 0,
      outcomeClosed: (ad as any).outcomeClosed ?? 0, outcomeFollowUp: (ad as any).outcomeFollowUp ?? 0,
      outcomeNoSale: (ad as any).outcomeNoSale ?? 0, outcomeUnqualified: (ad as any).outcomeUnqualified ?? 0,
    })))

    return {
      campaignName, campaignId: adsets[0]?.adsetId ?? null,
      isActive: adsets.some(a => a.isActive),
      adsets,
      ...withRatios(campRaw2),
    }
  }).sort((a, b) => (b.spend as number) - (a.spend as number))

  // Overall totals
  const allAds = campaigns.flatMap(c => c.adsets.flatMap(a => a.ads))
  const totalsRaw = sum(allAds.map(ad => ({
    spend: ad.spend, impressions: ad.impressions, reach: ad.reach, clicks: ad.clicks,
    leads: ad.leads, booked: ad.booked, shows: ad.shows, qualified: ad.qualified,
    closed: ad.closed, cashCollected: ad.cashCollected, contractRevenue: ad.contractRevenue,
    qualitySum: (ad as any).qualitySum ?? 0, qualityCount: (ad as any).qualityCount ?? 0,
    outcomeClosed: (ad as any).outcomeClosed ?? 0, outcomeFollowUp: (ad as any).outcomeFollowUp ?? 0,
    outcomeNoSale: (ad as any).outcomeNoSale ?? 0, outcomeUnqualified: (ad as any).outcomeUnqualified ?? 0,
  })))

  return NextResponse.json({
    campaigns,
    totals: withRatios(totalsRaw),
    lastSynced,
  })
}
