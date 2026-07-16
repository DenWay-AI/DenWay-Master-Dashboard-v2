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

async function ghlGet(path: string, token: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Version: VERSION },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GHL ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

async function syncCallsForClient(
  client: { id: string; name: string; ghl_location_id: string },
  token: string,
  sinceDate: Date
): Promise<{ conversations: number; calls: number }> {
  const locationId = client.ghl_location_id
  const sinceDateMs = sinceDate.getTime()
  const contactCache = new Map<string, any>()
  const callRows: any[] = []
  let totalConversations = 0
  let startAfterDate: number | undefined = undefined
  let hasMore = true

  while (hasMore) {
    const params = new URLSearchParams({
      locationId,
      limit: '100',
      sortBy: 'last_message_date',
      sortOrder: 'desc',
    })
    if (startAfterDate !== undefined) params.set('startAfterDate', String(startAfterDate))

    const data = await ghlGet(`/conversations/search?${params}`, token)

    const conversations: any[] = data.conversations ?? data.data ?? []
    if (conversations.length === 0) break
    totalConversations += conversations.length
    process.stdout.write(`\r  scanning… ${totalConversations} conversations, ${callRows.length} calls found`)

    let hitOldConversation = false

    for (const conv of conversations) {
      const lastMsgDate = conv.lastMessageDate ? new Date(conv.lastMessageDate).getTime() : 0
      if (lastMsgDate < sinceDateMs) {
        hitOldConversation = true
        break
      }

      // Fetch messages for this conversation
      try {
        await sleep(150)
        const msgData = await ghlGet(`/conversations/${conv.id}/messages`, token)
        // GHL returns { messages: { messages: [...], lastMessageId: "..." } } or { messages: [...] }
        const raw = msgData.messages
        const messages: any[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.messages)
          ? raw.messages
          : Array.isArray(msgData.data)
          ? msgData.data
          : []

        for (const msg of messages) {
          // Filter for call messages only
          const isCall =
            msg.type === 'TYPE_CALL' ||
            msg.messageType === 'TYPE_CALL' ||
            msg.messageTypeId === 10 ||
            msg.type === 'Call' ||
            msg.callDuration !== undefined

          if (!isCall) continue

          // Skip calls outside our date window
          const msgDate = msg.dateAdded ? new Date(msg.dateAdded).getTime() : 0
          if (msgDate < sinceDateMs) continue

          // Fetch contact for speed-to-lead
          const contactId = msg.contactId ?? conv.contactId ?? null
          if (contactId && !contactCache.has(contactId)) {
            try {
              await sleep(80)
              const cd = await ghlGet(`/contacts/${contactId}`, token)
              contactCache.set(contactId, cd.contact ?? cd)
            } catch {
              contactCache.set(contactId, null)
            }
          }

          const contact = contactId ? contactCache.get(contactId) : null
          const contactCreatedAt = contact
            ? (contact.dateAdded ?? contact.createdAt ?? null)
            : null

          callRows.push({
            client_id: client.id,
            ghl_message_id: msg.id,
            ghl_conversation_id: conv.id,
            ghl_contact_id: contactId,
            contact_name:
              contact?.contactName ??
              (contact?.firstName || contact?.lastName
                ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()
                : null) ??
              null,
            contact_phone: msg.from ?? msg.to ?? contact?.phone ?? null,
            direction: msg.direction ?? null,
            status: msg.callStatus ?? msg.status ?? null,
            duration_seconds: msg.callDuration != null ? Number(msg.callDuration) : null,
            ghl_user_id: msg.userId ?? conv.assignedTo ?? null,
            contact_created_at: contactCreatedAt
              ? new Date(contactCreatedAt).toISOString()
              : null,
            called_at: new Date(msg.dateAdded).toISOString(),
          })
        }
      } catch (e: any) {
        console.warn(`    ⚠ conv ${conv.id}: ${e.message}`)
      }
    }

    // Cursor: use the lastMessageDate of the oldest conversation in this page
    const lastConv = conversations[conversations.length - 1]
    const lastDate = lastConv?.lastMessageDate ? new Date(lastConv.lastMessageDate).getTime() : undefined
    startAfterDate = lastDate
    hasMore = !hitOldConversation && conversations.length === 100 && lastDate !== undefined
  }

  // Upsert in batches of 100
  for (let i = 0; i < callRows.length; i += 100) {
    const chunk = callRows.slice(i, i + 100)
    const { error } = await supabase
      .from('calls')
      .upsert(chunk, { onConflict: 'ghl_message_id' })
    if (error) throw new Error(`Upsert error: ${error.message}`)
  }

  console.log(
    `  ✓ ${client.name}: ${totalConversations} conversations scanned, ${callRows.length} calls synced`
  )
  return { conversations: totalConversations, calls: callRows.length }
}

async function getSinceDate(clientId: string): Promise<Date> {
  // Use the most recent call we have for this client as the incremental cursor.
  // If no calls exist yet, do a full 2-year historical pull.
  const { data } = await supabase
    .from('calls')
    .select('called_at')
    .eq('client_id', clientId)
    .order('called_at', { ascending: false })
    .limit(1)
    .single()

  if (data?.called_at) {
    // Overlap by 1 day to catch any calls that came in near the boundary
    const d = new Date(data.called_at)
    d.setDate(d.getDate() - 1)
    return d
  }

  // No calls yet — fetch 2 years of history
  const d = new Date()
  d.setFullYear(d.getFullYear() - 2)
  return d
}

async function main() {
  console.log(`🔄 Syncing GHL calls (incremental per client, up to 2yr history on first run)…\n`)

  // Get all active clients with a GHL location ID
  const { data: clients, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, ghl_location_id')
    .in('status', ['active', 'onboarding'])
    .not('ghl_location_id', 'is', null)

  if (clientErr) throw clientErr

  let totalCalls = 0
  let skipped = 0

  for (const client of clients ?? []) {
    const since = await getSinceDate(client.id)
    console.log(`→ ${client.name} (since ${since.toISOString().split('T')[0]})`)
    let token: string
    try {
      token = await getGhlToken(client.id)
    } catch (e: any) {
      console.warn(`  ⚠ No token — skipping (reconnect via Settings to enable calls sync)`)
      skipped++
      continue
    }
    try {
      const result = await syncCallsForClient(client as any, token, since)
      totalCalls += result.calls
    } catch (e: any) {
      console.error(`  ✗ ${e.message}`)
    }
    await sleep(500)
  }

  const processed = (clients ?? []).length - skipped
  console.log(`\n✅ Done — ${totalCalls} calls synced across ${processed} clients (${skipped} skipped, no token)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
