import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getGhlToken } from '@/lib/ghl/getToken'

export const dynamic = 'force-dynamic'

const GHL_BASE = 'https://services.leadconnectorhq.com'

export async function POST() {
  const supabase = createServerClient()

  // Get company token + companyId from raw field
  const { data: companyTokenRow, error: companyErr } = await supabase
    .from('oauth_tokens')
    .select('*')
    .eq('provider', 'ghl_company')
    .is('client_id', null)
    .single()

  if (companyErr || !companyTokenRow) {
    return NextResponse.json(
      { error: 'DenWay company account not connected. Connect it first via Settings.' },
      { status: 400 }
    )
  }

  const companyId = companyTokenRow.raw?.companyId ?? companyTokenRow.raw?.company_id
  if (!companyId) {
    return NextResponse.json(
      { error: 'Could not read companyId from stored company token. Re-connect the DenWay company account.' },
      { status: 400 }
    )
  }

  // Get company access token (refreshing if needed)
  let companyAccessToken: string
  try {
    companyAccessToken = await getGhlToken(null)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  // Get all clients that already have a location token
  const { data: existingTokens, error: tokensErr } = await supabase
    .from('oauth_tokens')
    .select('client_id')
    .eq('provider', 'ghl_location')
    .not('client_id', 'is', null)

  if (tokensErr) return NextResponse.json({ error: tokensErr.message }, { status: 500 })

  const clientIds = (existingTokens ?? []).map((t: any) => t.client_id)
  if (clientIds.length === 0) {
    return NextResponse.json({ results: [], message: 'No connected clients found.' })
  }

  // Load their location IDs
  const { data: clients, error: clientsErr } = await supabase
    .from('clients')
    .select('id, name, ghl_location_id')
    .in('id', clientIds)
    .not('ghl_location_id', 'is', null)

  if (clientsErr) return NextResponse.json({ error: clientsErr.message }, { status: 500 })

  const results: { name: string; status: 'ok' | 'error'; error?: string }[] = []

  for (const client of clients ?? []) {
    try {
      // Exchange company token for a location-scoped token
      const res = await fetch(`${GHL_BASE}/oauth/locationToken`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${companyAccessToken}`,
          'Content-Type': 'application/json',
          Version: '2021-04-15',
        },
        body: JSON.stringify({ companyId, locationId: client.ghl_location_id }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`GHL ${res.status}: ${text.slice(0, 200)}`)
      }

      const tokenData = await res.json()
      const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 86400) * 1000).toISOString()

      await supabase.from('oauth_tokens').upsert(
        {
          client_id: client.id,
          provider: 'ghl_location',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token ?? companyTokenRow.refresh_token,
          expires_at: expiresAt,
          scope: tokenData.scope ?? null,
          raw: tokenData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id,provider' }
      )

      results.push({ name: client.name, status: 'ok' })
    } catch (e: any) {
      results.push({ name: client.name, status: 'error', error: e.message })
    }
  }

  const succeeded = results.filter((r) => r.status === 'ok').length
  const failed = results.filter((r) => r.status === 'error').length

  return NextResponse.json({
    results,
    message: `Reconnected ${succeeded} client${succeeded !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}.`,
  })
}
