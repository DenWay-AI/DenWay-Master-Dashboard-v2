import { config } from 'dotenv'
config({ path: '.env.local' })

async function test(label: string, url: string, token: string, version = '2021-07-28', method = 'GET', body?: any) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, Version: version, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  console.log(`[${res.status}] ${label}`)
  console.log(`       ${text.slice(0, 250)}\n`)
}

async function main() {
  const token = process.env.GHL_AGENCY_TOKEN!
  const locId = 'IJpNwlZLdSv0B0FaoyuS'
  const companyId = 'PzAs2LXSs4trRsFqYXN0'

  // Try users with both companyId and locationId
  await test('users (both ids)',           `https://services.leadconnectorhq.com/users/?companyId=${companyId}&locationId=${locId}`, token)
  // Try different version for users
  await test('users (v2021-04-15)',        `https://services.leadconnectorhq.com/users/?locationId=${locId}`, token, '2021-04-15')
  // Try calendars with v2021-07-28
  await test('calendars (v2021-07-28)',    `https://services.leadconnectorhq.com/calendars/?locationId=${locId}`, token, '2021-07-28')
  // Try lc-api-key header approach
  await test('calendars (lc-api-key hdr)', `https://services.leadconnectorhq.com/calendars/?locationId=${locId}`, token, '2021-04-15')
  // Try alternate base URL
  await test('calendars (api.ghl.io)',     `https://rest.gohighlevel.com/v1/appointments/?calendarId=all`, token, '2021-04-15')
  // Company-level calendar events
  await test('calendar events (companyId)', `https://services.leadconnectorhq.com/calendars/events?companyId=${companyId}&startTime=1700000000000&endTime=1800000000000`, token, '2021-04-15')
}

main().catch(console.error)
