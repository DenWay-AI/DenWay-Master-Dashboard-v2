import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Public token-based portal — no auth required
  if (pathname.startsWith('/portal/')) {
    return supabaseResponse
  }

  // Allow login page through always
  if (pathname === '/login') {
    // If already logged in, redirect to appropriate page
    if (user) {
      const role = user.user_metadata?.role as string | undefined
      const repId = user.user_metadata?.rep_id as string | undefined
      if (role === 'rep' && repId) {
        return NextResponse.redirect(new URL(`/call-center/${repId}`, request.url))
      }
      if (role === 'client') {
        return NextResponse.redirect(new URL('/portal', request.url))
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // All other routes require auth
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const role = user.user_metadata?.role as string | undefined
  const repId = user.user_metadata?.rep_id as string | undefined

  // Reps can only access their own call-center page
  if (role === 'rep') {
    const allowedPath = `/call-center/${repId}`
    if (!pathname.startsWith(allowedPath)) {
      return NextResponse.redirect(new URL(allowedPath, request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
