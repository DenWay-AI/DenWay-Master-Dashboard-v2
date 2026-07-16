import { NextResponse } from 'next/server'
import { GHL_CLIENT_ID, GHL_REDIRECT_URI } from '@/config/env'

const GHL_AUTH_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation'

// Company-level scopes — needed for creating sub-accounts, listing locations
const COMPANY_SCOPES = [
  'locations.write',
  'locations.readonly',
].join(' ')

// Location-level scopes — needed for syncing appointments, calendars, users, calls
const LOCATION_SCOPES = [
  'calendars.readonly',
  'calendars/events.readonly',
  'contacts.readonly',
  'users.readonly',
  'conversations.readonly',
  'conversations/message.readonly',
].join(' ')

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')   // UUID of the client being connected
  const type = searchParams.get('type')            // 'company' for company-level

  const appClientId = GHL_CLIENT_ID
  const redirectUri = GHL_REDIRECT_URI

  if (!appClientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing GHL_CLIENT_ID or GHL_REDIRECT_URI in environment' },
      { status: 500 }
    )
  }

  const isCompany = type === 'company' || !clientId
  const scope = isCompany ? COMPANY_SCOPES : LOCATION_SCOPES

  // state encodes what we're connecting so the callback knows what to do
  const state = isCompany ? 'company' : `client:${clientId}`

  const params = new URLSearchParams({
    client_id: appClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    state,
  })

  const oauthUrl = `${GHL_AUTH_URL}?${params.toString()}`
  return NextResponse.redirect(oauthUrl)
}
