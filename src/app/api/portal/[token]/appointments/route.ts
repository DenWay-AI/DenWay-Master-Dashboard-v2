import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  req: Request,
  { params }: { params: { token: string } }
) {
  const supabase = createServerClient()

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name')
    .eq('portal_token', params.token)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(`
      id, scheduled_at, contact_name, contact_email, contact_phone,
      status, outcome, treatment_value, became_patient, lead_quality_score,
      consultation_outcome, appointment_notes
    `)
    .eq('client_id', client.id)
    .order('scheduled_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    clientName: client.name,
    appointments: appointments ?? [],
  })
}
