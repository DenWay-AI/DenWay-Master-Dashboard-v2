import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_FIELDS = ['outcome', 'consultation_outcome', 'treatment_value', 'became_patient', 'lead_quality_score', 'appointment_notes'] as const
type AllowedField = typeof ALLOWED_FIELDS[number]

export async function PATCH(
  req: Request,
  { params }: { params: { token: string; id: string } }
) {
  const supabase = createServerClient()

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id')
    .eq('portal_token', params.token)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Verify appointment belongs to this client
  const { data: existing, error: fetchErr } = await supabase
    .from('appointments')
    .select('id, client_id')
    .eq('id', params.id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
  }

  if (existing.client_id !== client.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const updates: Partial<Record<AllowedField, unknown>> = {}
  for (const field of ALLOWED_FIELDS) {
    if (field in body) updates[field] = body[field]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', params.id)
    .select('id, outcome, treatment_value, became_patient, lead_quality_score')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
