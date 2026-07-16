import { createClient } from '@supabase/supabase-js'

const LOCATION_ID = 'qwaeKgJBI8IG0GfFYnoa'
const PIPELINE_ID = 'qDgE8UO4nfdt4oViwOaj'
const GHL_BASE = 'https://services.leadconnectorhq.com'

export interface OpportunitiesSyncResult {
  fetched: number
  upserted: number
  errors: string[]
  durationMs: number
}

interface GhlOpportunity {
  id: string
  name: string
  status: 'open' | 'won' | 'lost' | 'abandoned'
  monetaryValue?: number
  pipelineId: string
  pipelineStageId: string
  contact: { id: string; name?: string; email?: string }
  createdAt: string
  updatedAt: string
}

interface GhlStage {
  id: string
  name: string
}

async function fetchStages(ghlPit: string): Promise<Map<string, string>> {
  const stageMap = new Map<string, string>()
  try {
    const res = await fetch(
      `${GHL_BASE}/opportunities/pipelines?locationId=${LOCATION_ID}`,
      {
        headers: {
          Authorization: `Bearer ${ghlPit}`,
          Version: '2021-07-28',
          Accept: 'application/json',
        },
      }
    )
    if (!res.ok) return stageMap
    const data = await res.json()
    const pipelines: Array<{ id: string; stages?: GhlStage[] }> = data.pipelines ?? []
    const target = pipelines.find(p => p.id === PIPELINE_ID) ?? pipelines[0]
    for (const s of target?.stages ?? []) stageMap.set(s.id, s.name)
  } catch {
    // fallback: no stage names
  }
  return stageMap
}

async function fetchAllOpportunities(ghlPit: string): Promise<GhlOpportunity[]> {
  const all: GhlOpportunity[] = []
  let startAfterId: string | null = null
  let startAfter: number | null = null
  const limit = 100
  let page = 0

  while (true) {
    page++
    const params = new URLSearchParams({
      location_id: LOCATION_ID,
      pipeline_id: PIPELINE_ID,
      limit: String(limit),
    })
    if (startAfterId) params.set('startAfterId', startAfterId)
    if (startAfter)   params.set('startAfter', String(startAfter))

    process.stdout.write(`  page ${page} (cursor=${startAfterId ?? 'start'})...\n`)

    const res = await fetch(`${GHL_BASE}/opportunities/search?${params}`, {
      headers: {
        Authorization: `Bearer ${ghlPit}`,
        Version: '2021-07-28',
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`GHL opportunities API ${res.status}: ${await res.text()}`)
    }

    const data = await res.json()
    const opps: GhlOpportunity[] = data.opportunities ?? []
    all.push(...opps)

    const meta = data.meta ?? {}
    if (!meta.nextPageUrl || opps.length === 0) break

    // Use cursor fields directly from meta (both required for correct paging)
    startAfterId = meta.startAfterId ?? null
    startAfter   = meta.startAfter   ?? null
    if (!startAfterId) break
  }

  return all
}

export async function syncB2bOpportunities(): Promise<OpportunitiesSyncResult> {
  const start = Date.now()
  const errors: string[] = []

  // Read env vars lazily so dotenv has time to load them
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const ghlPit = process.env.DENWAY_GHL_PIT!

  const supabase = createClient(supabaseUrl, supabaseKey)

  const [stageMap, opps] = await Promise.all([
    fetchStages(ghlPit),
    fetchAllOpportunities(ghlPit),
  ])

  let upserted = 0
  const BATCH = 100

  for (let i = 0; i < opps.length; i += BATCH) {
    const batch = opps.slice(i, i + BATCH)
    const updates = batch.map(opp => ({
      ghl_contact_id: opp.contact.id,
      opportunity_id: opp.id,
      opportunity_name: opp.name,
      opportunity_status: opp.status,
      pipeline_stage: stageMap.get(opp.pipelineStageId) ?? opp.pipelineStageId,
      pipeline_stage_id: opp.pipelineStageId,
      opportunity_monetary_value: opp.monetaryValue ?? null,
      opportunity_created_at: opp.createdAt,
      opportunity_updated_at: opp.updatedAt,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('b2b_contacts')
      .upsert(updates, { onConflict: 'ghl_contact_id', ignoreDuplicates: false })

    if (error) {
      errors.push(`batch ${i}-${i + BATCH}: ${error.message}`)
    } else {
      upserted += batch.length
    }
  }

  return { fetched: opps.length, upserted, errors, durationMs: Date.now() - start }
}
