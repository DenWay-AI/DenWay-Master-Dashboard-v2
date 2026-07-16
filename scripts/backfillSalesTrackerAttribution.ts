/**
 * Backfill b2b_sales_tracker.ad_name/ad_set_name/campaign_name from b2b_contacts
 * (matched by email). Only fills NULL columns — never overwrites existing data.
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
  // Pull sales rows missing attribution
  const sales: any[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('b2b_sales_tracker')
      .select('id, email, ad_name, ad_set_name, campaign_name')
      .or('ad_name.is.null,ad_set_name.is.null,campaign_name.is.null')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || !data.length) break
    sales.push(...data)
    if (data.length < PAGE) break
  }
  console.log(`Sales rows missing attribution: ${sales.length}`)

  const emails = Array.from(new Set(sales.map(s => s.email).filter(Boolean)))
  if (!emails.length) { console.log('No emails to look up'); return }

  // Pull contacts for those emails (in chunks since IN clauses get long)
  const contactsByEmail: Record<string, any> = {}
  const CHUNK = 100
  for (let i = 0; i < emails.length; i += CHUNK) {
    const slice = emails.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('b2b_contacts')
      .select('email, ad_name, ad_set_name, campaign_name')
      .in('email', slice)
    if (error) throw error
    for (const c of data ?? []) contactsByEmail[c.email] = c
  }
  console.log(`Matched contacts: ${Object.keys(contactsByEmail).length} / ${emails.length}`)

  let updated = 0, noop = 0
  for (const s of sales) {
    const c = s.email && contactsByEmail[s.email]
    if (!c) { noop++; continue }
    const patch: Record<string, string> = {}
    if (!s.ad_name && c.ad_name) patch.ad_name = c.ad_name
    if (!s.ad_set_name && c.ad_set_name) patch.ad_set_name = c.ad_set_name
    if (!s.campaign_name && c.campaign_name) patch.campaign_name = c.campaign_name
    if (!Object.keys(patch).length) { noop++; continue }
    const { error: e } = await supabase.from('b2b_sales_tracker').update(patch).eq('id', s.id)
    if (e) { console.error(`Row ${s.id}: ${e.message}`); continue }
    updated++
  }
  console.log(`\nDONE. Updated ${updated} | No-op ${noop} | Total ${sales.length}`)
}

main().catch(e => { console.error(e); process.exit(1) })
