import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { APP_URL, GHL_CLIENT_ID, GHL_CLIENT_SECRET, GHL_REDIRECT_URI } from '@/config/env'

const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = APP_URL

  if (error) {
    return NextResponse.redirect(`${appUrl}/settings?oauth_error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/settings?oauth_error=missing_code_or_state`)
  }

  const appClientId = GHL_CLIENT_ID
  const appClientSecret = GHL_CLIENT_SECRET
  const redirectUri = GHL_REDIRECT_URI

  if (!appClientId || !appClientSecret || !redirectUri) {
    return NextResponse.redirect(`${appUrl}/settings?oauth_error=missing_env_vars`)
  }

  // Exchange code for tokens
  const tokenRes = await fetch(GHL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: appClientId,
      client_secret: appClientSecret,
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    console.error('GHL token exchange failed:', tokenRes.status, text)
    return NextResponse.redirect(
      `${appUrl}/settings?oauth_error=${encodeURIComponent('token_exchange_failed')}`
    )
  }

  const tokenData = await tokenRes.json()
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

  // Decode state to determine what we connected
  const isCompany = state === 'company'
  const clientId = state.startsWith('client:') ? state.replace('client:', '') : null
  const provider = isCompany ? 'ghl_company' : 'ghl_location'

  const supabase = createServerClient()

  // Delete existing token for this provider/client combination, then insert fresh
  const deleteQuery = supabase.from('oauth_tokens').delete().eq('provider', provider)
  if (clientId) {
    await deleteQuery.eq('client_id', clientId)
  } else {
    await deleteQuery.is('client_id', null)
  }

  const insertData: Record<string, unknown> = {
    provider,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: expiresAt,
    scope: tokenData.scope ?? null,
    raw: tokenData,
  }
  if (clientId) insertData.client_id = clientId

  const { error: dbError } = await supabase.from('oauth_tokens').insert(insertData)

  if (dbError) {
    console.error('Failed to store GHL token:', dbError)
    return NextResponse.redirect(
      `${appUrl}/settings?oauth_error=${encodeURIComponent('db_store_failed')}`
    )
  }

  // Also store the GHL location ID on the client record if available
  if (clientId && tokenData.locationId) {
    await supabase
      .from('clients')
      .update({ ghl_location_id: tokenData.locationId })
      .eq('id', clientId)
  }

  const who = isCompany ? 'company' : `client:${clientId}`
  console.log(`✓ GHL OAuth connected: ${who}`)

  return NextResponse.redirect(`${appUrl}/settings?oauth_success=true`)
}
