import { Client } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

const DB_URL = 'postgresql://postgres.lkuejxtwdofclhkcwpic:SuccessLovesSpeed1!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
const SQL = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '024_portal_token.sql'), 'utf8')

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  console.log('Applying migration 024_portal_token...')
  await client.query(SQL)
  console.log('Done.')
  const { rows } = await client.query('SELECT COUNT(*) AS n FROM clients WHERE portal_token IS NOT NULL')
  console.log(`Clients with portal_token: ${rows[0].n}`)
  await client.end()
}
main().catch(e => { console.error(e); process.exit(1) })
