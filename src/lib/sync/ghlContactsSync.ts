import { createClient } from '@supabase/supabase-js'

const LOCATION_ID = 'qwaeKgJBI8IG0GfFYnoa'
const GHL_BASE = 'https://services.leadconnectorhq.com'

const FIELD_MAP: Record<string, string> = {
  '746W2ID5u7TbAzdRcbb2': 'utm_medium',
  '9w0lhYXeR0Al6A8wtfxj': 'utm_term',
  YhzFNV3uPuCusqVp5b7A: 'utm_campaign',
  cqAM4lZ12JlTlwqAhhPG: 'utm_source',
  hXOUrLkIeXLLMTxlVFRc: 'ad_name',
  jsCBsljfyqPFmX3YSHfd: 'utm_content',
  pWjbZHb0zasbhPWJPXcV: 'campaign_name',
  tKRWYukmP4LkZg4zcdn2: 'ad_set_name',
  vMYKuhLUtowmChFHYZQj: 'landing_page_source',
  BX6woXJVL7lZIhaa95aK: 'campaign_id',
  Ich3A7SeFubvW6HMPLHE: 'ad_set_id',
  JsigUtY3s0P17AjGvfTG: 'utm_id',
  QsbnhmJKRPALlPPzLZAK: 'utm_event_source',
}

export interface ContactSyncResult {
  fetched: number
  upserted: number
  errors: string[]
  durationMs: number
}

async function fetchAllContacts(): Promise<unknown[]> {
  const pit = process.env.DENWAY_GHL_PIT!
  const headers = {
    Authorization: `Bearer ${pit}`,
    Version: '2021-07-28',
  }

  const contacts: unknown[] = []
  let url = `${GHL_BASE}/contacts/?locationId=${LOCATION_ID}&limit=100`

  while (url) {
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`GHL fetch failed: ${res.status} ${await res.text()}`)
    const data = await res.json()
    contacts.push(...(data.contacts ?? []))

    const next = data.meta?.nextPageUrl
    if (!next) break

    const parsed = new URL(next)
    const startAfter = parsed.searchParams.get('startAfter')
    const startAfterId = parsed.searchParams.get('startAfterId')
    url =
      startAfter && startAfterId
        ? `${GHL_BASE}/contacts/?locationId=${LOCATION_ID}&limit=100&startAfter=${startAfter}&startAfterId=${startAfterId}`
        : ''
  }

  return contacts
}

function decodeCustomFields(fields: { id: string; value: unknown }[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const f of fields ?? []) {
    const key = FIELD_MAP[f.id] ?? f.id
    result[key] = f.value
  }
  return result
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapContact(c: any) {
  const decoded = decodeCustomFields(c.customFields ?? [])
  const firstName = c.firstName ?? ''
  const lastName = c.lastName ?? ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || c.name || null

  return {
    ghl_contact_id: c.id,
    location_id: LOCATION_ID,
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName,
    email: c.email ?? null,
    phone: c.phone ?? null,
    company_name: c.companyName ?? null,
    source: c.source ?? null,
    tags: c.tags ?? [],
    date_added: c.dateAdded ?? null,
    // Prefer dedicated GHL Attribution custom fields; fall back to UTM params
    // since the landing page reliably populates utm_content/utm_term/utm_campaign
    // from Meta's tracking template ({{ad.name}}, {{adset.name}}, {{campaign.name}}).
    ad_name: (decoded.ad_name as string) || (decoded.utm_content as string) || null,
    ad_set_name: (decoded.ad_set_name as string) || (decoded.utm_term as string) || null,
    campaign_name: (decoded.campaign_name as string) || (decoded.utm_campaign as string) || null,
    utm_source: (decoded.utm_source as string) ?? null,
    utm_medium: (decoded.utm_medium as string) ?? null,
    utm_campaign: (decoded.utm_campaign as string) ?? null,
    utm_content: (decoded.utm_content as string) ?? null,
    utm_term: (decoded.utm_term as string) ?? null,
    landing_page_source: (decoded.landing_page_source as string) ?? null,
    custom_fields: decoded,
    updated_at: new Date().toISOString(),
  }
}

export async function syncB2bContacts(): Promise<ContactSyncResult> {
  const start = Date.now()
  const errors: string[] = []

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const rawContacts = await fetchAllContacts()
  const fetched = rawContacts.length

  const rows = rawContacts.map(mapContact)

  const BATCH = 200
  let upserted = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error, count } = await supabase
      .from('b2b_contacts')
      .upsert(batch, { onConflict: 'ghl_contact_id', count: 'exact' })

    if (error) {
      errors.push(`Batch ${i / BATCH + 1}: ${error.message}`)
    } else {
      upserted += count ?? batch.length
    }
  }

  return { fetched, upserted, errors, durationMs: Date.now() - start }
}
