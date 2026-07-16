import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { META_ACCESS_TOKEN } from '@/config/env'

export const dynamic = 'force-dynamic'

async function fetchMetaAccounts() {
  const token = META_ACCESS_TOKEN
  if (!token) return []

  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status&limit=100&access_token=${token}`
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.data ?? []
}

export async function GET() {
  const supabase = createServerClient()

  const [{ data: clients }, metaAccounts] = await Promise.all([
    supabase.from('clients').select('id, name, status, meta_ad_account_id').order('name'),
    fetchMetaAccounts(),
  ])

  return NextResponse.json({ clients: clients ?? [], metaAccounts })
}

export async function PATCH(req: Request) {
  const supabase = createServerClient()
  const { clientId, meta_ad_account_id } = await req.json()

  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })

  const { error } = await supabase
    .from('clients')
    .update({ meta_ad_account_id: meta_ad_account_id || null })
    .eq('id', clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
