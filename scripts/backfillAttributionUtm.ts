/**
 * One-off backfill: copy utm_content/utm_term/utm_campaign into
 * ad_name/ad_set_name/campaign_name for rows where the dedicated
 * fields are NULL. Existing values are NEVER overwritten.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const all: any[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('b2b_contacts')
      .select('id, ad_name, ad_set_name, campaign_name, utm_content, utm_term, utm_campaign')
      .or('ad_name.is.null,ad_set_name.is.null,campaign_name.is.null')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || !data.length) break
    all.push(...data)
    if (data.length < PAGE) break
  }
  const data = all
  console.log(`Candidates: ${data.length}`)

  let updated = 0, noop = 0
  for (const r of data) {
    const patch: Record<string, string> = {}
    if (!r.ad_name && r.utm_content) patch.ad_name = r.utm_content as string
    if (!r.ad_set_name && r.utm_term) patch.ad_set_name = r.utm_term as string
    if (!r.campaign_name && r.utm_campaign) patch.campaign_name = r.utm_campaign as string
    if (!Object.keys(patch).length) { noop++; continue }
    const { error: e } = await supabase.from('b2b_contacts').update(patch).eq('id', r.id)
    if (e) { console.error(`Row ${r.id}: ${e.message}`); continue }
    updated++
  }
  console.log(`\nDONE. Updated ${updated} | No-op ${noop} | Total ${data.length}`)
}

main().catch(e => { console.error(e); process.exit(1) })
