import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalize(s: string | null | undefined) {
  return (s ?? '').toLowerCase().trim()
}

function titleContainsName(title: string, leadName: string): boolean {
  if (!title || !leadName) return false
  const name = normalize(leadName).trim()
  // Require at least 5 chars and both first+last name for safety
  if (name.length < 5) return false
  const parts = name.split(/\s+/).filter(p => p.length > 2)
  if (parts.length < 2) return false  // single-word names are too ambiguous
  const t = normalize(title)
  return parts.every(p => t.includes(p))
}

async function main() {
  // Fetch all b2b records
  const { data: b2bRecords, error: b2bErr } = await supabase
    .from('b2b_sales_tracker')
    .select('id, lead_name, company_name, email')
  if (b2bErr) throw b2bErr

  // Index b2b by email for fast lookup
  const b2bByEmail = new Map<string, string>() // email → b2b id
  const b2bByName: Array<{ id: string; lead_name: string }> = []

  for (const row of b2bRecords ?? []) {
    if (row.email) b2bByEmail.set(normalize(row.email), row.id)
    if (row.lead_name) b2bByName.push({ id: row.id, lead_name: row.lead_name })
  }

  // Fetch all fathom calls without a b2b link
  const { data: calls, error: callsErr } = await supabase
    .from('fathom_calls')
    .select('id, recording_id, title, participants')
    .is('b2b_tracker_id', null)
  if (callsErr) throw callsErr

  console.log(`Matching ${calls?.length ?? 0} unlinked Fathom calls against ${b2bRecords?.length ?? 0} B2B records…\n`)

  let matched = 0
  let alreadyLinked = 0

  for (const call of calls ?? []) {
    let b2bId: string | null = null
    let matchReason = ''

    // 1. Email match — check external participants
    const participants: any[] = call.participants ?? []
    for (const p of participants) {
      const email = normalize(p.email)
      if (email && b2bByEmail.has(email)) {
        b2bId = b2bByEmail.get(email)!
        matchReason = `email: ${p.email}`
        break
      }
    }

    // 2. Name match — lead name words appear in call title
    if (!b2bId && call.title) {
      for (const b2b of b2bByName) {
        if (titleContainsName(call.title, b2b.lead_name)) {
          b2bId = b2b.id
          matchReason = `name: "${b2b.lead_name}" in title "${call.title}"`
          break
        }
      }
    }

    if (!b2bId) continue

    const { error } = await supabase
      .from('fathom_calls')
      .update({ b2b_tracker_id: b2bId, category: 'sales_call' })
      .eq('id', call.id)

    if (error) {
      console.error(`  ❌ Failed to link ${call.title}: ${error.message}`)
    } else {
      console.log(`  ✅ Linked: "${call.title}" → B2B (${matchReason})`)
      matched++
    }
  }

  console.log(`\nDone. Matched: ${matched}, Already linked: ${alreadyLinked}`)
}

main().catch(e => { console.error(e); process.exit(1) })
