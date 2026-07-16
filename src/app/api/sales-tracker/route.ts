import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = createServerClient()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const view = searchParams.get('view') // 'links' for Settings panel

  if (view === 'links') {
    // Linked records (have a client_id)
    const { data: linked } = await supabase
      .from('b2b_sales_tracker')
      .select('id, company_name, call_outcome, contract_value, cash_collected, closer, appointment_date, client_id, clients(name)')
      .not('client_id', 'is', null)
      .order('appointment_date', { ascending: false })

    // Unlinked records that have a closed outcome or non-zero value (priority to link)
    const { data: unlinked } = await supabase
      .from('b2b_sales_tracker')
      .select('id, company_name, lead_name, call_outcome, contract_value, cash_collected, closer, appointment_date')
      .is('client_id', null)
      .or('call_outcome.eq.Closed,contract_value.gt.0,cash_collected.gt.0')
      .order('appointment_date', { ascending: false })

    // All clients for the selector dropdown
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, status')
      .in('status', ['active', 'onboarding', 'paused', 'churned'])
      .order('name')

    return NextResponse.json({
      linked: linked ?? [],
      unlinked: unlinked ?? [],
      clients: clients ?? [],
    })
  }

  let query = supabase
    .from('b2b_sales_tracker')
    .select('*, clients(name)')
    .order('appointment_date', { ascending: false })

  if (from) query = query.gte('appointment_date', from)
  if (to) query = query.lte('appointment_date', to)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ records: data ?? [] })
}

export async function PATCH(req: Request) {
  const supabase = createServerClient()
  const body = await req.json()
  const { id, ...fields } = body

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('b2b_sales_tracker')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
