import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const token = process.env.GHL_AGENCY_TOKEN!
  const companyId = 'PzAs2LXSs4trRsFqYXN0'
  const testLocationId = 'IJpNwlZLdSv0B0FaoyuS' // Carroll Gardens — known active client

  console.log(`Testing token exchange for locationId: ${testLocationId}`)
  const res = await fetch('https://services.leadconnectorhq.com/oauth/locationToken', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyId, locationId: testLocationId }),
  })
  const text = await res.text()
  console.log(`Status: ${res.status}`)
  console.log(`Response: ${text.slice(0, 500)}`)

  if (res.ok) {
    const data = JSON.parse(text)
    const locationToken = data.token || data.access_token
    console.log('\n✅ Got location token! Testing users endpoint...')

    const usersRes = await fetch(`https://services.leadconnectorhq.com/users/?locationId=${testLocationId}`, {
      headers: { Authorization: `Bearer ${locationToken}`, Version: '2021-07-28' }
    })
    console.log(`Users endpoint: ${usersRes.status}: ${(await usersRes.text()).slice(0, 300)}`)
  }
}

main().catch(console.error)
