import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { getGhlToken } from './ghlToken'

const BASE = 'https://services.leadconnectorhq.com'
const VERSION = '2021-04-15'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  // Get DenWay's client record
  const locationId = process.env.DENWAY_GHL_LOCATION_ID
  if (!locationId) throw new Error('Missing DENWAY_GHL_LOCATION_ID in .env.local')

  const { data: clientRow } = await supabase
    .from('clients')
    .select('id, name')
    .eq('ghl_location_id', locationId)
    .single()

  if (!clientRow) throw new Error(`No client found with ghl_location_id=${locationId}`)
  console.log(`DenWay client: ${clientRow.name} (${clientRow.id})`)

  const token = await getGhlToken(clientRow.id)
  console.log('✓ Got DenWay OAuth token\n')

  // Load all appointments missing contact data or ghl_calendar_id
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, ghl_contact_id, ghl_calendar_id, raw')
    .eq('client_id', clientRow.id)
    .or('contact_name.is.null,ghl_calendar_id.is.null')

  if (error) throw error
  console.log(`Found ${appointments?.length ?? 0} appointments to backfill\n`)

  let updated = 0
  let failed = 0
  const contactCache = new Map<string, any>()

  for (const appt of appointments ?? []) {
    const updates: Record<string, any> = {}

    // Backfill ghl_calendar_id from raw
    if (!appt.ghl_calendar_id && appt.raw?.calendarId) {
      updates.ghl_calendar_id = appt.raw.calendarId
    }

    // Backfill contact data
    const contactId = appt.ghl_contact_id ?? appt.raw?.contactId
    if (contactId) {
      if (!contactCache.has(contactId)) {
        await sleep(100)
        try {
          const res = await fetch(`${BASE}/contacts/${contactId}`, {
            headers: { Authorization: `Bearer ${token}`, Version: VERSION },
          })
          if (res.ok) {
            const data = await res.json()
            contactCache.set(contactId, data.contact ?? data)
          } else {
            const text = await res.text()
            console.warn(`  ⚠ contact ${contactId}: ${res.status} ${text.slice(0, 80)}`)
            contactCache.set(contactId, null)
          }
        } catch (e: any) {
          contactCache.set(contactId, null)
        }
      }

      const contact = contactCache.get(contactId)
      if (contact) {
        const name = contact.name ||
          [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null
        updates.contact_name = name
        updates.contact_email = contact.email || null
        updates.contact_phone = contact.phone || contact.phoneNumber || null
        updates.company_name = contact.companyName || contact.company || null
        updates.ghl_contact_id = contactId
      }
    }

    if (Object.keys(updates).length === 0) continue

    const { error: updateErr } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', appt.id)

    if (updateErr) {
      console.error(`  ✗ ${appt.id}: ${updateErr.message}`)
      failed++
    } else {
      const name = updates.contact_name ?? '(no name)'
      const company = updates.company_name ?? '(no company)'
      console.log(`  ✓ ${name} — ${company}`)
      updated++
    }
  }

  console.log(`\n✅ Done — ${updated} updated, ${failed} failed`)
}

main().catch((e) => { console.error(e); process.exit(1) })
