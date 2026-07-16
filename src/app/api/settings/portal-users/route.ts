import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { APP_URL } from '@/config/env'

export async function POST(req: Request) {
  const supabase = createServerClient()
  const body = await req.json()
  const { email, clientId } = body

  if (!email || !clientId) {
    return NextResponse.json({ error: 'email and clientId are required' }, { status: 400 })
  }

  // Verify client exists
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', clientId)
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Create Supabase auth user and send invite email
  const { data: userData, error: userErr } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      role: 'client',
      client_id: clientId,
    },
    redirectTo: `${APP_URL}/portal`,
  })

  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 400 })
  }

  const userId = userData.user.id

  // Create user_profiles row
  const { error: profileErr } = await supabase.from('user_profiles').upsert({
    id: userId,
    role: 'client',
    client_id: clientId,
  })

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  return NextResponse.json({
    userId,
    email,
    clientId,
    clientName: client.name,
    message: `Invite sent to ${email}`,
  })
}

export async function GET(req: Request) {
  const supabase = createServerClient()

  // Return all portal users (role=client) with their linked client
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, client_id, clients(name)')
    .eq('role', 'client')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get emails from auth.users (admin API)
  const userIds = (data ?? []).map((u) => u.id)
  const emails: Record<string, string> = {}

  for (const uid of userIds) {
    const { data: authUser } = await supabase.auth.admin.getUserById(uid)
    if (authUser?.user) emails[uid] = authUser.user.email ?? ''
  }

  const users = (data ?? []).map((u: any) => ({
    id: u.id,
    email: emails[u.id] ?? null,
    clientId: u.client_id,
    clientName: u.clients?.name ?? null,
  }))

  return NextResponse.json(users)
}
