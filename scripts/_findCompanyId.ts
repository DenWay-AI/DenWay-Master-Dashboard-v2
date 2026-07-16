import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const token = process.env.GHL_AGENCY_TOKEN
  if (!token) { console.error('No GHL_AGENCY_TOKEN in .env.local'); process.exit(1) }

  console.log('Testing agency token...\n')

  const endpoints = [
    { url: 'https://services.leadconnectorhq.com/companies/', label: 'companies' },
    { url: 'https://services.leadconnectorhq.com/oauth/installedLocations?appId=__', label: 'installedLocations' },
  ]

  for (const { url, label } of endpoints) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Version: '2021-07-28', 'Content-Type': 'application/json' }
    })
    const text = await res.text()
    console.log(`[${label}] ${res.status}: ${text.slice(0, 500)}\n`)
  }
}

main().catch(console.error)
