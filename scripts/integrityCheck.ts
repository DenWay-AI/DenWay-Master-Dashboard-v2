/**
 * integrityCheck.ts
 *
 * Full data integrity audit + Fathom call linking.
 *
 * Usage:
 *   npx tsx scripts/integrityCheck.ts           # audit only (no writes)
 *   npx tsx scripts/integrityCheck.ts --fix     # audit + auto-link fixes
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const FIX = process.argv.includes('--fix')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalise(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function dateOnly(ts: string | null | undefined): string | null {
  if (!ts) return null
  const d = new Date(ts)
  if (isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}

function section(title: string) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('═'.repeat(60))
}

function row(label: string, value: any, warn = false) {
  const flag = warn ? '  ⚠' : '   '
  console.log(`${flag} ${label.padEnd(42)} ${value}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(FIX
    ? '✍️  AUDIT + FIX MODE — will write linking fixes to DB\n'
    : '👀 AUDIT ONLY — pass --fix to also apply fixes\n'
  )

  // ── 1. Load all data ───────────────────────────────────────────────────────

  // Paginate a full table (Supabase default limit = 1000)
  async function fetchAll<T>(table: string, select: string): Promise<T[]> {
    const PAGE = 1000
    const all: T[] = []
    let from = 0
    while (true) {
      const { data, error } = await supabase.from(table).select(select).range(from, from + PAGE - 1)
      if (error) { console.error(`  ⚠ ${table} query error: ${error.message}`); break }
      if (!data || data.length === 0) break
      all.push(...data as T[])
      if (data.length < PAGE) break
      from += PAGE
    }
    return all
  }

  const [
    allClients,
    allAppts,
    allB2b,
    allCalls,
    allMeta,
    allReps,
  ] = await Promise.all([
    fetchAll<any>('clients', 'id, name, status, ghl_location_id, meta_ad_account_id, enrollment_fee, pps_fee, monthly_retainer_usd, date_closed'),
    fetchAll<any>('appointments', 'id, client_id, ghl_appointment_id, ghl_contact_id, contact_name, contact_email, contact_phone, scheduled_at, status, outcome, consultation_outcome, treatment_value, lead_quality_score, airtable_record_id'),
    fetchAll<any>('b2b_sales_tracker', 'id, airtable_record_id, ghl_appointment_id, client_id, lead_name, company_name, email, phone, appointment_date, date_booked, show_status, call_outcome, contract_value, closer'),
    fetchAll<any>('calls', 'id, client_id, ghl_contact_id, direction, status, called_at'),
    fetchAll<any>('meta_ad_snapshots', 'id, client_id, date, spend, impressions, clicks, leads'),
    fetchAll<any>('reps', 'id, name, ghl_user_id'),
  ])

  const { data: syncRunsData } = await supabase
    .from('sync_runs').select('id, provider, status, started_at, finished_at, message')
    .order('started_at', { ascending: false }).limit(10)
  const allSyncRuns = syncRunsData ?? []


  // ── 2. CLIENTS ─────────────────────────────────────────────────────────────

  section('CLIENTS')
  const activeClients = allClients.filter(c => ['active', 'onboarding'].includes(c.status))
  const clientById = new Map(allClients.map(c => [c.id, c]))

  row('Total clients', allClients.length)
  row('Active / onboarding', activeClients.length)
  row('Inactive / churned', allClients.filter(c => !['active', 'onboarding'].includes(c.status)).length)

  const noGhl = allClients.filter(c => !c.ghl_location_id)
  row('Without GHL location ID', noGhl.length, noGhl.length > 0)
  noGhl.forEach(c => console.log(`     → ${c.name} (${c.status})`))

  const noMeta = activeClients.filter(c => !c.meta_ad_account_id)
  row('Active with no Meta ad account', noMeta.length, noMeta.length > 0)
  noMeta.forEach(c => console.log(`     → ${c.name}`))

  const noFinancials = allClients.filter(c => !c.enrollment_fee && !c.cash_collected)
  row('Missing financials (enrollment_fee + cash)', noFinancials.length, noFinancials.length > 0)

  // Duplicate GHL location IDs
  const ghlLocIds = allClients.filter(c => c.ghl_location_id).map(c => c.ghl_location_id)
  const dupGhlLoc = ghlLocIds.filter((id, i) => ghlLocIds.indexOf(id) !== i)
  row('Duplicate GHL location IDs', dupGhlLoc.length, dupGhlLoc.length > 0)
  dupGhlLoc.forEach(id => console.log(`     → ${id}`))

  // ── 3. APPOINTMENTS ────────────────────────────────────────────────────────

  section('APPOINTMENTS (B2C consultations)')
  const apptsByClient = new Map<string, typeof allAppts>()
  for (const a of allAppts) {
    const list = apptsByClient.get(a.client_id) ?? []
    list.push(a)
    apptsByClient.set(a.client_id, list)
  }

  row('Total appointments', allAppts.length)

  const fromGhl = allAppts.filter(a => a.ghl_appointment_id)
  const fromAt = allAppts.filter(a => a.airtable_record_id)
  const fromBoth = allAppts.filter(a => a.ghl_appointment_id && a.airtable_record_id)
  row('Sourced from GHL', fromGhl.length)
  row('Patched from Airtable (have airtable_id)', fromAt.length)
  row('Linked to BOTH sources', fromBoth.length)

  const orphanAppts = allAppts.filter(a => !clientById.has(a.client_id))
  row('Orphaned (no matching client)', orphanAppts.length, orphanAppts.length > 0)

  // Duplicate GHL appointment IDs
  const ghlApptIds = fromGhl.map(a => a.ghl_appointment_id)
  const dupApptIds = ghlApptIds.filter((id, i) => ghlApptIds.indexOf(id) !== i)
  row('Duplicate ghl_appointment_id', dupApptIds.length, dupApptIds.length > 0)

  // Outcome coverage
  const withOutcome = allAppts.filter(a => a.outcome && a.outcome !== 'unknown')
  const withConsultOutcome = allAppts.filter(a => a.consultation_outcome)
  const withTreatmentVal = allAppts.filter(a => a.treatment_value)
  row('With show/no-show outcome', withOutcome.length)
  row('With consultation outcome', withConsultOutcome.length)
  row('With treatment value', withTreatmentVal.length)

  // Outcome breakdown
  const outcomeMap: Record<string, number> = {}
  allAppts.forEach(a => { const k = a.outcome ?? 'null'; outcomeMap[k] = (outcomeMap[k] ?? 0) + 1 })
  console.log('\n   Outcome breakdown:')
  Object.entries(outcomeMap).sort((a,b) => b[1]-a[1]).forEach(([k,v]) =>
    console.log(`     ${k.padEnd(15)} ${v}`)
  )

  const consultMap: Record<string, number> = {}
  allAppts.forEach(a => { const k = a.consultation_outcome ?? 'null'; consultMap[k] = (consultMap[k] ?? 0) + 1 })
  console.log('\n   Consultation outcome breakdown:')
  Object.entries(consultMap).sort((a,b) => b[1]-a[1]).forEach(([k,v]) =>
    console.log(`     ${k.padEnd(30)} ${v}`)
  )

  // Date range
  const sortedDates = allAppts.map(a => a.scheduled_at).filter(Boolean).sort()
  if (sortedDates.length) {
    console.log(`\n   Date range: ${sortedDates[0]?.slice(0,10)} → ${sortedDates[sortedDates.length-1]?.slice(0,10)}`)
  }

  // Per-client appointment counts
  console.log('\n   Per-client appointment counts:')
  activeClients
    .sort((a,b) => (apptsByClient.get(b.id)?.length ?? 0) - (apptsByClient.get(a.id)?.length ?? 0))
    .forEach(c => {
      const count = apptsByClient.get(c.id)?.length ?? 0
      const flag = count === 0 ? '  ⚠' : '   '
      console.log(`  ${flag} ${c.name.padEnd(40)} ${count} appointments`)
    })

  // ── 4. CALLS ───────────────────────────────────────────────────────────────

  section('GHL CALLS (speed-to-lead / activity)')
  row('Total calls', allCalls.length)

  const orphanCalls = allCalls.filter(c => !clientById.has(c.client_id))
  row('Orphaned calls (no matching client)', orphanCalls.length, orphanCalls.length > 0)

  const callsByClient = new Map<string, number>()
  allCalls.forEach(c => { callsByClient.set(c.client_id, (callsByClient.get(c.client_id) ?? 0) + 1) })
  console.log('\n   Per-client call counts:')
  activeClients
    .sort((a,b) => (callsByClient.get(b.id) ?? 0) - (callsByClient.get(a.id) ?? 0))
    .forEach(c => {
      const count = callsByClient.get(c.id) ?? 0
      const flag = count === 0 ? '  ⚠' : '   '
      console.log(`  ${flag} ${c.name.padEnd(40)} ${count} calls`)
    })

  // ── 5. META ADS ────────────────────────────────────────────────────────────

  section('META AD SNAPSHOTS')
  row('Total daily snapshots', allMeta.length)

  const metaByClient = new Map<string, typeof allMeta>()
  allMeta.forEach(s => {
    const list = metaByClient.get(s.client_id) ?? []
    list.push(s)
    metaByClient.set(s.client_id, list)
  })

  console.log('\n   Per-client Meta coverage:')
  activeClients
    .sort((a,b) => (metaByClient.get(b.id)?.length ?? 0) - (metaByClient.get(a.id) ?? 0))
    .forEach(c => {
      const snaps = metaByClient.get(c.id) ?? []
      const hasAcct = !!c.meta_ad_account_id
      if (!hasAcct) {
        console.log(`     ⚠ ${c.name.padEnd(40)} no ad account configured`)
        return
      }
      if (snaps.length === 0) {
        console.log(`     ⚠ ${c.name.padEnd(40)} 0 snapshots (has account: ${c.meta_ad_account_id})`)
        return
      }
      const dates = snaps.map(s => s.date).filter(Boolean).sort()
      const totalSpend = snaps.reduce((sum, s) => sum + (Number(s.spend) || 0), 0)
      console.log(`      ${c.name.padEnd(40)} ${snaps.length} days | $${totalSpend.toFixed(0)} spend | ${dates[0]} → ${dates[dates.length-1]}`)
    })

  // ── 6. B2B SALES TRACKER (FATHOM CALLS) ───────────────────────────────────

  section('B2B SALES TRACKER (Fathom calls)')
  row('Total records', allB2b.length)

  const b2bFromAt = allB2b.filter(r => r.airtable_record_id)
  const b2bFromGhl = allB2b.filter(r => r.ghl_appointment_id && !r.airtable_record_id)
  const b2bLinkedToAppt = allB2b.filter(r => r.ghl_appointment_id)
  const b2bLinkedToClient = allB2b.filter(r => r.client_id)
  const b2bLinkedToBoth = allB2b.filter(r => r.ghl_appointment_id && r.client_id)
  const b2bUnlinkedAppt = allB2b.filter(r => !r.ghl_appointment_id)
  const b2bUnlinkedClient = allB2b.filter(r => !r.client_id)

  row('From Airtable (Fathom call log)', b2bFromAt.length)
  row('From GHL strategy calendar', b2bFromGhl.length)
  row('Linked to GHL appointment', b2bLinkedToAppt.length)
  row('Linked to client', b2bLinkedToClient.length)
  row('Linked to BOTH (fully linked)', b2bLinkedToBoth.length)
  row('NOT linked to any appointment', b2bUnlinkedAppt.length, b2bUnlinkedAppt.length > 0)
  row('NOT linked to any client', b2bUnlinkedClient.length, b2bUnlinkedClient.length > 0)

  // Show status breakdown
  const showMap: Record<string, number> = {}
  allB2b.forEach(r => { const k = r.show_status ?? 'null'; showMap[k] = (showMap[k] ?? 0) + 1 })
  console.log('\n   Show status breakdown:')
  Object.entries(showMap).sort((a,b) => b[1]-a[1]).forEach(([k,v]) =>
    console.log(`     ${k.padEnd(20)} ${v}`)
  )

  const outcomeMapB2b: Record<string, number> = {}
  allB2b.forEach(r => { const k = r.call_outcome ?? 'null'; outcomeMapB2b[k] = (outcomeMapB2b[k] ?? 0) + 1 })
  console.log('\n   Call outcome breakdown:')
  Object.entries(outcomeMapB2b).sort((a,b) => b[1]-a[1]).forEach(([k,v]) =>
    console.log(`     ${k.padEnd(30)} ${v}`)
  )

  // ── 7. FATHOM → APPOINTMENT LINKING ────────────────────────────────────────

  section('FATHOM → GHL APPOINTMENT LINKING')

  // Build lookup maps from appointments
  // Key: email + date
  const apptByEmailDate = new Map<string, typeof allAppts[0]>()
  // Key: normalised name + date
  const apptByNameDate = new Map<string, typeof allAppts[0]>()
  // Key: phone + date
  const apptByPhoneDate = new Map<string, typeof allAppts[0]>()

  for (const a of allAppts) {
    const d = dateOnly(a.scheduled_at)
    if (!d) continue

    if (a.contact_email) {
      const key = `${normalise(a.contact_email)}__${d}`
      if (!apptByEmailDate.has(key)) apptByEmailDate.set(key, a)
    }
    if (a.contact_name) {
      const key = `${normalise(a.contact_name)}__${d}`
      if (!apptByNameDate.has(key)) apptByNameDate.set(key, a)
    }
    if (a.contact_phone) {
      const cleaned = a.contact_phone.replace(/\D/g, '').slice(-10)
      if (cleaned.length >= 7) {
        const key = `${cleaned}__${d}`
        if (!apptByPhoneDate.has(key)) apptByPhoneDate.set(key, a)
      }
    }
  }

  // GHL appointment ID lookup
  const apptByGhlId = new Map(allAppts.filter(a => a.ghl_appointment_id).map(a => [a.ghl_appointment_id, a]))

  let linkedByEmail = 0
  let linkedByName = 0
  let linkedByPhone = 0
  let stillUnlinked = 0

  const fixes: { b2bId: string; ghlApptId: string; method: string; label: string }[] = []

  for (const b2b of b2bUnlinkedAppt) {
    const d = dateOnly(b2b.appointment_date?.toString() ?? null)

    let match: typeof allAppts[0] | undefined

    // Method 1: email + date
    if (!match && b2b.email && d) {
      match = apptByEmailDate.get(`${normalise(b2b.email)}__${d}`)
      if (match) linkedByEmail++
    }

    // Method 2: phone + date
    if (!match && b2b.phone && d) {
      const cleaned = b2b.phone.replace(/\D/g, '').slice(-10)
      if (cleaned.length >= 7) {
        match = apptByPhoneDate.get(`${cleaned}__${d}`)
        if (match) linkedByPhone++
      }
    }

    // Method 3: name + date
    if (!match && b2b.lead_name && d) {
      match = apptByNameDate.get(`${normalise(b2b.lead_name)}__${d}`)
      if (match) linkedByName++
    }

    if (match?.ghl_appointment_id) {
      const method = !b2b.email ? (b2b.phone ? 'phone+date' : 'name+date') :
        (linkedByEmail > (fixes.filter(f => f.method === 'email+date').length)) ? 'email+date' :
        (linkedByPhone > (fixes.filter(f => f.method === 'phone+date').length)) ? 'phone+date' : 'name+date'

      fixes.push({
        b2bId: b2b.id,
        ghlApptId: match.ghl_appointment_id,
        method: (b2b.email && apptByEmailDate.has(`${normalise(b2b.email)}__${d}`)) ? 'email+date' :
                (b2b.phone && apptByPhoneDate.has(`${b2b.phone.replace(/\D/g, '').slice(-10)}__${d}`)) ? 'phone+date' : 'name+date',
        label: `${b2b.lead_name ?? '?'} | ${b2b.company_name ?? '?'} | ${d}`,
      })
    } else {
      stillUnlinked++
    }
  }

  row('Can link by email + date', linkedByEmail)
  row('Can link by phone + date', linkedByPhone)
  row('Can link by name + date', linkedByName)
  row('Total new links found', fixes.length)
  row('Still cannot link', stillUnlinked, stillUnlinked > 0)

  if (fixes.length > 0) {
    console.log('\n   Sample linkable records (first 15):')
    fixes.slice(0, 15).forEach(f =>
      console.log(`     [${f.method}] ${f.label}`)
    )
    if (fixes.length > 15) console.log(`     … and ${fixes.length - 15} more`)
  }

  if (stillUnlinked > 0) {
    console.log('\n   Unlink-able records (no matching GHL appointment found):')
    b2bUnlinkedAppt
      .filter(b => !fixes.find(f => f.b2bId === b.id))
      .slice(0, 15)
      .forEach(b => console.log(`     ${b.lead_name ?? '?'} | ${b.company_name ?? '?'} | appt date: ${b.appointment_date ?? '?'} | email: ${b.email ?? 'none'}`))
    if (stillUnlinked > 15) console.log(`     … and ${stillUnlinked - 15} more`)
  }

  // ── 8. FATHOM → CLIENT LINKING ─────────────────────────────────────────────

  section('FATHOM → CLIENT LINKING')

  const clientByNormName = new Map<string, typeof allClients[0]>()
  for (const c of allClients) {
    clientByNormName.set(normalise(c.name), c)
  }

  const clientFixes: { b2bId: string; clientId: string; method: string; label: string }[] = []

  for (const b2b of b2bUnlinkedClient) {
    if (!b2b.company_name) continue

    const normCompany = normalise(b2b.company_name)
    let matchClient: typeof allClients[0] | undefined

    // Exact match
    matchClient = clientByNormName.get(normCompany)

    // Partial match if no exact (require at least 5 chars to avoid false positives)
    if (!matchClient && normCompany.length >= 5) {
      for (const [key, c] of clientByNormName) {
        if (key.length >= 5 && (normCompany.includes(key) || key.includes(normCompany))) {
          matchClient = c
          break
        }
      }
    }

    if (matchClient) {
      clientFixes.push({
        b2bId: b2b.id,
        clientId: matchClient.id,
        method: clientByNormName.has(normCompany) ? 'exact' : 'partial',
        label: `"${b2b.company_name}" → client "${matchClient.name}"`,
      })
    }
  }

  row('Unlinked to client', b2bUnlinkedClient.length)
  row('Can auto-link to client', clientFixes.length)
  row('Cannot match to client', b2bUnlinkedClient.length - clientFixes.length)

  if (clientFixes.length > 0) {
    console.log('\n   Client matches found (first 20):')
    clientFixes.slice(0, 20).forEach(f =>
      console.log(`     [${f.method}] ${f.label}`)
    )
    if (clientFixes.length > 20) console.log(`     … and ${clientFixes.length - 20} more`)
  }

  // ── 9. APPLY FIXES ─────────────────────────────────────────────────────────

  if (FIX) {
    section('APPLYING FIXES')

    // Merge Airtable outcome data onto the existing GHL-sourced row, then delete the Airtable duplicate
    if (fixes.length > 0) {
      console.log(`\n   Merging ${fixes.length} Airtable Fathom records onto their GHL-sourced counterparts…`)
      let merged = 0, deleted = 0, fail = 0

      // Build a map from ghl_appointment_id → ghl-sourced b2b row
      const ghlB2bByApptId = new Map(
        allB2b.filter(r => r.ghl_appointment_id && !r.airtable_record_id)
              .map(r => [r.ghl_appointment_id, r])
      )
      // Build map from b2bId → airtable row for outcome data
      const b2bById = new Map(allB2b.map(r => [r.id, r]))

      for (const f of fixes) {
        const atRow = b2bById.get(f.b2bId)          // the Airtable-sourced row
        const ghlRow = ghlB2bByApptId.get(f.ghlApptId) // the GHL-sourced row
        if (!atRow || !ghlRow) { fail++; continue }

        // Delete the Airtable-only duplicate first (releases the unique airtable_record_id constraint)
        const { error: delErr } = await supabase
          .from('b2b_sales_tracker')
          .delete()
          .eq('id', atRow.id)
        if (delErr) { console.error(`   ❌ delete dup ${f.label}: ${delErr.message}`); fail++; continue }
        deleted++

        // Patch outcome fields + airtable_record_id from Airtable onto the GHL row
        const patch: Record<string, any> = { airtable_record_id: atRow.airtable_record_id }
        if (atRow.show_status && !ghlRow.show_status)   patch.show_status    = atRow.show_status
        if (atRow.call_outcome && !ghlRow.call_outcome) patch.call_outcome   = atRow.call_outcome
        if (atRow.contract_value)                       patch.contract_value = atRow.contract_value
        if (atRow.closer && !ghlRow.closer)             patch.closer         = atRow.closer

        const { error: patchErr } = await supabase
          .from('b2b_sales_tracker')
          .update(patch)
          .eq('id', ghlRow.id)

        if (patchErr) { console.error(`   ❌ patch ${f.label}: ${patchErr.message}`); fail++; continue }
        merged++
      }
      console.log(`   ✅ Merged: ${merged} | Duplicates removed: ${deleted} | Errors: ${fail}`)
    }

    // Apply client links
    if (clientFixes.length > 0) {
      console.log(`\n   Linking ${clientFixes.length} Fathom records to clients…`)
      let ok = 0, fail = 0
      for (const f of clientFixes) {
        const { error } = await supabase
          .from('b2b_sales_tracker')
          .update({ client_id: f.clientId, updated_at: new Date().toISOString() })
          .eq('id', f.b2bId)
        if (error) { console.error(`   ❌ ${f.label}: ${error.message}`); fail++ }
        else ok++
      }
      console.log(`   ✅ Client links: ${ok} ok, ${fail} failed`)
    }

    if (fixes.length === 0 && clientFixes.length === 0) {
      console.log('   No fixes needed.')
    }
  } else if (fixes.length > 0 || clientFixes.length > 0) {
    console.log(`\n⚡ Run with --fix to apply ${fixes.length} appointment links + ${clientFixes.length} client links.`)
  }

  // ── 10. RECENT SYNC RUNS ───────────────────────────────────────────────────

  section('RECENT SYNC RUNS')
  allSyncRuns.slice(0, 8).forEach(r => {
    const flag = r.status === 'success' ? '✅' : '❌'
    const dur = r.finished_at
      ? `${Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000)}s`
      : 'running'
    console.log(`   ${flag} ${r.provider.padEnd(20)} ${r.started_at?.slice(0,16)} (${dur}) ${r.message?.slice(0, 50) ?? ''}`)
  })

  // ── 11. SUMMARY SCORECARD ──────────────────────────────────────────────────

  section('DATA INTEGRITY SCORECARD')

  const totalIssues = [
    noGhl.length > 0,
    noMeta.length > 0,
    orphanAppts.length > 0,
    dupApptIds.length > 0,
    orphanCalls.length > 0,
    b2bUnlinkedAppt.length > 0,
    b2bUnlinkedClient.length > 0,
  ].filter(Boolean).length

  const score = Math.round(((7 - totalIssues) / 7) * 100)

  console.log(`\n   Integrity score: ${score}%  (${7 - totalIssues}/7 checks passing)\n`)
  console.log(`   ✅ Clients with GHL               ${noGhl.length === 0 ? 'PASS' : `FAIL (${noGhl.length} missing)`}`)
  console.log(`   ✅ Active clients with Meta        ${noMeta.length === 0 ? 'PASS' : `FAIL (${noMeta.length} missing)`}`)
  console.log(`   ✅ No orphaned appointments        ${orphanAppts.length === 0 ? 'PASS' : `FAIL (${orphanAppts.length} orphans)`}`)
  console.log(`   ✅ No duplicate appt IDs           ${dupApptIds.length === 0 ? 'PASS' : `FAIL (${dupApptIds.length} dupes)`}`)
  console.log(`   ✅ No orphaned calls               ${orphanCalls.length === 0 ? 'PASS' : `FAIL (${orphanCalls.length} orphans)`}`)
  console.log(`   ✅ B2B linked to appointments      ${b2bUnlinkedAppt.length === 0 ? 'PASS' : FIX ? `FIXED (${fixes.length} linked)` : `FAIL (${b2bUnlinkedAppt.length} unlinked — run --fix)`}`)
  console.log(`   ✅ B2B linked to clients           ${b2bUnlinkedClient.length === 0 ? 'PASS' : FIX ? `FIXED (${clientFixes.length} linked)` : `FAIL (${b2bUnlinkedClient.length} unlinked — run --fix)`}`)

  if (!FIX && (fixes.length > 0 || clientFixes.length > 0)) {
    console.log(`\n   → Re-run with --fix to apply ${fixes.length + clientFixes.length} auto-link fixes`)
  }
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
