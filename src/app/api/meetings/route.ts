import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('b2b_meetings')
    .select(`
      *,
      b2b_leads(id, lead_name, company_name, email, phone, qualified, call_outcome, contract_value, cash_collected, lead_quality_score, ad_name, ad_set_name, campaign_name)
    `)
    .order('scheduled_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meetings: data ?? [] })
}

export async function PATCH(req: Request) {
  const supabase = createServerClient()
  const body = await req.json()
  const { id, ...fields } = body

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('b2b_meetings')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
