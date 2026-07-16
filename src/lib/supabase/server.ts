import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server-side client using service role key — bypasses RLS, only use in API routes
export function createServerClient() {
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local')
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
