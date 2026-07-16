/**
 * Script-compatible GHL token helper.
 * Reads from oauth_tokens table, refreshes if needed, returns access_token.
 * Used by syncAll.ts and other sync scripts that run outside of Next.js.
 */
import { createClient } from '@supabase/supabase-js'

const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

export async function getGhlToken(clientId?: string | null): Promise<string> {
  const supabase = getSupabase()
  const provider = clientId ? 'ghl_location' : 'ghl_company'

  const query = supabase
    .from('oauth_tokens')
    .select('id, access_token, refresh_token, expires_at')
    .eq('provider', provider)

  const { data: token, error } = clientId
    ? await query.eq('client_id', clientId).single()
    : await query.is('client_id', null).single()

  if (error || !token) {
    const who = clientId ? `client ${clientId}` : 'DenWay company account'
    throw new Error(
      `No GHL OAuth token found for ${who}. Connect via Settings → GHL Integration.`
    )
  }

  const expiresAt = new Date(token.expires_at)
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000)

  if (expiresAt > fiveMinFromNow) {
    return token.access_token
  }

  // Refresh
  const appClientId = process.env.GHL_CLIENT_ID
  const appClientSecret = process.env.GHL_CLIENT_SECRET
  if (!appClientId || !appClientSecret) {
    throw new Error('Missing GHL_CLIENT_ID or GHL_CLIENT_SECRET')
  }

  const res = await fetch(GHL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
      client_id: appClientId,
      client_secret: appClientSecret,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GHL token refresh failed (${res.status}): ${text}`)
  }

  const refreshed = await res.json()
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

  await supabase
    .from('oauth_tokens')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? token.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', token.id)

  console.log(`  ↻ GHL token refreshed for ${clientId ?? 'company'}`)
  return refreshed.access_token
}
