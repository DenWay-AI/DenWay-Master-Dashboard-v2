import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const EDITABLE_FIELDS = [
  'status', 'outcome', 'consultation_outcome',
  'treatment_value', 'became_patient', 'lead_quality_score',
  'contact_name', 'contact_email', 'contact_phone',
  'notes',
] as const

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient()
  const body = await req.json()

  const updates: Record<string, unknown> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
