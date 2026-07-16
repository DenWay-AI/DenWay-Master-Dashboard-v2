import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const EDITABLE_FIELDS = [
  'name', 'status',
  'legal_business_name', 'owner_name', 'doctor_name',
  'owner_email', 'company_email', 'owner_phone', 'personal_phone', 'front_desk_phone',
  'city', 'state', 'business_address', 'zip_code', 'country', 'area', 'time_zone',
  'onboarding_status', 'priority', 'defcon_status', 'service_type', 'launched',
  'payment_plan', 'pps_fee', 'ppp_fee', 'monthly_retainer_usd', 'monthly_retainer_dkk',
  'enrollment_fee', 'sms_fees', 'currency', 'daily_ad_spend_agreed', 'date_closed',
  'closer_name', 'csm_name', 'media_buyer_name',
  'website_url', 'facebook_url', 'google_drive_url', 'fathom_link',
  'consultation_hours', 'offer', 'deal_description',
  'total_locations', 'accepts_spanish_patients', 'financing_options',
  'contract_signed', 'paid', 'ads_setup',
  'ghl_location_id',
] as const

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('clients')
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
    .from('clients')
    .update(updates)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
