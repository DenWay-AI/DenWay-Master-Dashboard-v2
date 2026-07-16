import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { getGhlToken } from './ghlToken'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: token } = await sb
    .from('oauth_tokens')
    .select('id, provider, expires_at, updated_at, client_id')
    .eq('client_id', '2def2b19-9159-4f34-ae5c-104292e03d25')
    .single()

  console.log('Token record:', token)
  console.log('Expires at:', token?.expires_at)
  console.log('Expired?', token?.expires_at ? new Date(token.expires_at) < new Date() : 'unknown')

  // Try to get/refresh it
  console.log('\nAttempting getGhlToken...')
  const accessToken = await getGhlToken('2def2b19-9159-4f34-ae5c-104292e03d25')
  console.log('Got token, length:', accessToken.length)

  // Test it against the calendars/events endpoint
  console.log('\nTesting against GHL calendars endpoint...')
  const res = await fetch(
    `https://services.leadconnectorhq.com/calendars/events?locationId=qwaeKgJBI8IG0GfFYnoa&calendarId=xQv7TasR6ehmGgAmV3dk&startTime=${Date.now() - 86400000 * 7}&endTime=${Date.now()}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Version: '2021-04-15' } }
  )
  console.log('Status:', res.status)
  const body = await res.text()
  console.log('Response:', body.slice(0, 300))
}

main().catch(console.error)
