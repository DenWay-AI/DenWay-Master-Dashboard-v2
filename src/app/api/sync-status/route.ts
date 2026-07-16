import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServerClient()

  const { data } = await supabase
    .from('sync_runs')
    .select('finished_at, status, message, provider')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    lastSync: data?.finished_at ?? null,
    status: data?.status ?? null,
    message: data?.message ?? null,
    provider: data?.provider ?? null,
    hasGhlData: !!data,
  })
}
