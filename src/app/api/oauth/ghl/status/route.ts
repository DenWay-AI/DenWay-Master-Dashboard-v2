import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServerClient()

  const { data: tokens, error } = await supabase
    .from('oauth_tokens')
    .select('*')

  if (error) {
    console.error('oauth_tokens query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const now = new Date()
  const isValid = (expiresAt: string) => new Date(expiresAt) > now

  const company = tokens?.find(t => t.provider === 'ghl_company' && !t.client_id)
  const locationTokens = tokens?.filter(t => t.provider === 'ghl_location' && t.client_id) ?? []

  return NextResponse.json({
    company: company
      ? { connected: true, valid: isValid(company.expires_at), expiresAt: company.expires_at }
      : { connected: false },
    locations: locationTokens.map(t => ({
      clientId: t.client_id,
      connected: true,
      valid: isValid(t.expires_at),
      expiresAt: t.expires_at,
    })),
  })
}
