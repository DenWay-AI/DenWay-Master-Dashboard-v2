import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: clients } = await sb
    .from('clients').select('id').eq('ghl_location_id', 'qwaeKgJBI8IG0GfFYnoa').limit(1)
  const clientId = clients?.[0]?.id
  if (!clientId) { console.error('DenWay client not found'); process.exit(1) }
  console.log('DenWay client ID:', clientId)

  const { error } = await sb
    .from('b2b_sales_tracker')
    .update({ client_id: clientId })
    .is('client_id', null)
  console.log(error ? `Error: ${error.message}` : 'Done — all unlinked rows patched with client_id')
}

main().catch(e => { console.error(e); process.exit(1) })
