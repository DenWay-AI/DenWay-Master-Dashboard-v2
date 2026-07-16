import { createServerClient } from '@/lib/supabase/server'

const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token'

/**
 * Returns a valid GHL access token for the given client (location-level)
 * or for DenWay's own company account if clientId is not provided.
 * Automatically refreshes the token if it's within 5 minutes of expiring.
 */
export async function getGhlToken(clientId?: string | null): Promise<string> {
  const supabase = createServerClient()
  const provider = clientId ? 'ghl_location' : 'ghl_company'

  let query = supabase
    .from('oauth_tokens')
    .select('id, access_token, refresh_token, expires_at')
    .eq('provider', provider)

  if (clientId) {
    query = query.eq('client_id', clientId)
  } else {
    query = query.is('client_id', null)
  }

  const { data: token, error } = await query.single()

  if (error || !token) {
    const who = clientId ? `client ${clientId}` : 'DenWay company account'
    throw new Error(`No GHL OAuth token found for ${who}. Connect via Settings → GHL.`)
  }

  // Check if token is still valid (with 5 min buffer)
  const expiresAt = new Date(token.expires_at)
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000)

  if (expiresAt > fiveMinFromNow) {
    return token.access_token
  }

  // Token is expired or about to expire — refresh it
  const clientIdEnv = process.env.GHL_CLIENT_ID
  const clientSecret = process.env.GHL_CLIENT_SECRET

  if (!clientIdEnv || !clientSecret) {
    throw new Error('Missing GHL_CLIENT_ID or GHL_CLIENT_SECRET in environment')
  }

  const res = await fetch(GHL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
      client_id: clientIdEnv,
      client_secret: clientSecret,
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

  return refreshed.access_token
}
