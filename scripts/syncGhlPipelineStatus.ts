import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

// Sales Pipeline (qDgE8UO4nfdt4oViwOaj) stage ID → client status
// Only opportunities in this pipeline trigger status changes
const PIPELINE_ID = 'qDgE8UO4nfdt4oViwOaj'

const STAGE_ID_TO_STATUS: Record<string, string> = {
  '30ea81f3-2d27-40bf-9921-0ab9f39f0a0d': 'onboarding',  // Onboarding
  '991f0d5f-3b76-4f81-8814-4c9e1e6f1ffa': 'active',      // Closed - New Client
  'fb7db47a-dab2-4eb4-b3a1-85487f9a1841': 'churned',     // Not Closed
  '197da1df-efe9-4e08-8249-2da913669824': 'churned',     // Unqualified
}

function mapStageToStatus(stageId: string): string | null {
  return STAGE_ID_TO_STATUS[stageId] ?? null
}

async function fetchOpportunities(locationId: string, token: string): Promise<any[]> {
  const all: any[] = []
  let page = 1

  while (true) {
    const url = new URL('https://services.leadconnectorhq.com/opportunities/search')
    url.searchParams.set('location_id', locationId)
    url.searchParams.set('pipeline_id', PIPELINE_ID)
    url.searchParams.set('limit', '100')
    url.searchParams.set('page', String(page))

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`GHL API error (${res.status}): ${text}`)
    }

    const data = await res.json()
    const opportunities = data.opportunities ?? data.data ?? []

    if (opportunities.length === 0) break
    all.push(...opportunities)

    if (all.length >= (data.meta?.total ?? all.length)) break
    page++
  }

  return all
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const ghlToken = process.env.GHL_ACCESS_TOKEN
  const locationId = process.env.DENWAY_GHL_LOCATION_ID

  if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase env vars')
  if (!ghlToken) throw new Error('Missing GHL_ACCESS_TOKEN')
  if (!locationId) throw new Error('Missing DENWAY_GHL_LOCATION_ID')

  const supabase = createClient(supabaseUrl, serviceKey)

  // Fetch all clients with a name to match against
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, status')
    .not('name', 'is', null)

  if (error) throw error
  if (!clients?.length) { console.log('No clients found.'); return }

  console.log(`Fetched ${clients.length} clients from Supabase`)

  // Fetch all opportunities from GHL
  console.log('Fetching GHL pipeline opportunities…')
  const opportunities = await fetchOpportunities(locationId, ghlToken)
  console.log(`Found ${opportunities.length} opportunities in GHL`)


  let updated = 0
  let skipped = 0
  let unmatched = 0

  for (const opp of opportunities) {
    const stageId: string = opp.pipelineStageId ?? ''
    const newStatus = mapStageToStatus(stageId)

    if (!newStatus) {
      console.log(`  ⚠ No mapping for stage ID "${stageId}" (${opp.name}) — skipping`)
      unmatched++
      continue
    }

    // Match opportunity to client by name (case-insensitive)
    const oppName = (opp.name ?? opp.contactName ?? '').toLowerCase().trim()
    const client = clients.find(c =>
      c.name && (
        c.name.toLowerCase().trim() === oppName ||
        oppName.includes(c.name.toLowerCase().trim()) ||
        c.name.toLowerCase().trim().includes(oppName)
      )
    )

    if (!client) {
      console.log(`  — No client match for opportunity "${opp.name}"`)
      unmatched++
      continue
    }

    if (client.status === newStatus) {
      skipped++
      continue
    }

    const { error: updateErr } = await supabase
      .from('clients')
      .update({ status: newStatus })
      .eq('id', client.id)

    if (updateErr) {
      console.error(`  ❌ Failed to update ${client.name}: ${updateErr.message}`)
      continue
    }

    console.log(`  ✅ ${client.name}: "${client.status}" → "${newStatus}" (stage ID: "${stageId}")`)
    updated++
  }

  console.log(`\nDone. Updated: ${updated}, Already correct: ${skipped}, Unmatched: ${unmatched}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
