'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { tenantConfig } from '@/config/tenant.config'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const role  = data.user?.user_metadata?.role as string | undefined
    const repId = data.user?.user_metadata?.rep_id as string | undefined

    if (role === 'rep' && repId) {
      router.push(`/call-center/${repId}`)
    } else {
      router.push('/dashboard')
    }
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: 'var(--canvas)',
    }}>
      <div className="animate-fade-up" style={{
        width: '100%',
        maxWidth: '360px',
        background: 'var(--surface-1)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-pop)',
        padding: '2rem',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.75rem', gap: '10px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-0.02em',
          }}>
            {tenantConfig.brand_initial}
          </div>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
              {tenantConfig.company_name}
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-faint)', marginTop: '2px' }}>
              Sign in to your account
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <label htmlFor="email" style={{
              display: 'block',
              fontSize: '0.6875rem',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: 'var(--ink-faint)',
              marginBottom: '6px',
            }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface-2)',
                border: '1px solid var(--line-strong)',
                borderRadius: 'var(--radius)',
                color: 'var(--ink)',
                padding: '8px 12px',
                fontSize: '0.875rem',
                outline: 'none',
              }}
              placeholder="you@denway.com"
              required
              autoComplete="email"
              onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--line-strong)' }}
            />
          </div>

          <div>
            <label htmlFor="password" style={{
              display: 'block',
              fontSize: '0.6875rem',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: 'var(--ink-faint)',
              marginBottom: '6px',
            }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface-2)',
                border: '1px solid var(--line-strong)',
                borderRadius: 'var(--radius)',
                color: 'var(--ink)',
                padding: '8px 12px',
                fontSize: '0.875rem',
                outline: 'none',
              }}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--line-strong)' }}
            />
          </div>

          {error && (
            <div style={{
              fontSize: '0.8125rem',
              color: 'var(--negative-hex)',
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.2)',
              borderRadius: 'var(--radius)',
              padding: '8px 12px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              padding: '9px 1rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 150ms ease, background 150ms ease',
              marginTop: '4px',
              boxShadow: '0 4px 16px -6px rgba(139,92,246,0.5)',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
