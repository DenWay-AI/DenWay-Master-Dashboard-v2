import { config } from 'dotenv'
config({ path: '.env.local' })

function main() {
  const token = process.env.GHL_AGENCY_TOKEN
  if (!token) { console.error('No GHL_AGENCY_TOKEN'); process.exit(1) }

  const parts = token.split('.')
  if (parts.length !== 3) {
    console.log('Token is not a JWT (no 3 parts) — may be an API key, not decodable')
    return
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    console.log('JWT payload fields:', Object.keys(payload))
    // Print non-sensitive fields that might contain the companyId
    const safe = Object.fromEntries(
      Object.entries(payload).filter(([k]) =>
        ['company_id', 'companyId', 'sub', 'aud', 'type', 'role', 'channel', 'source', 'iat', 'exp'].includes(k)
      )
    )
    console.log('Relevant fields:', JSON.stringify(safe, null, 2))
  } catch (e) {
    console.error('Could not decode:', e)
  }
}

main()
