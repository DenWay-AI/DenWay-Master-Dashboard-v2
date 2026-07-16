'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { tenantConfig } from '@/config/tenant.config'

/* ─── Icons ──────────────────────────────────────────────── */
const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)
const IconTrendingUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
)
const IconTarget = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
  </svg>
)
const IconBarChart = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
)
const IconBuilding = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
  </svg>
)
const IconUsers = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const IconPhone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.36 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.3 2.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)
const IconSettings = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)
const IconLogOut = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)
const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

/* ─── Nav config ─────────────────────────────────────────── */
const NAV = [
  {
    label: null,
    items: [
      { label: 'Overview', href: '/dashboard', icon: <IconGrid /> },
    ],
  },
  {
    label: 'B2B',
    items: [
      { label: 'Overview',    href: '/b2b',            icon: <IconTrendingUp /> },
      { label: 'Sales Calls', href: '/sales-tracker',  icon: <IconTarget /> },
      { label: 'B2B Ads',    href: '/b2b-ads',        icon: <IconBarChart /> },
    ],
  },
  {
    label: 'B2C',
    items: [
      { label: 'Clients',       href: '/clients',     icon: <IconBuilding /> },
      { label: 'Consultations', href: '/b2c',         icon: <IconUsers /> },
      { label: 'B2C Ads',      href: '/ads',          icon: <IconBarChart /> },
      { label: 'Call Center',  href: '/call-center',  icon: <IconPhone /> },
    ],
  },
]

/* ─── Sidebar ────────────────────────────────────────────── */
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const W = collapsed ? 56 : 220

  return (
    <aside style={{
      width: W,
      minWidth: W,
      background: 'var(--surface-1)',
      borderRight: '1px solid var(--line)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 250ms ease, min-width 250ms ease',
      overflow: 'hidden',
      position: 'sticky',
      top: 0,
      height: '100vh',
      zIndex: 10,
      flexShrink: 0,
    }}>

      {/* Logo */}
      <div style={{
        padding: collapsed ? '14px 0' : '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        borderBottom: '1px solid var(--line)',
        justifyContent: collapsed ? 'center' : 'flex-start',
        flexShrink: 0,
        minHeight: '56px',
      }}>
        <div style={{
          width: '28px',
          height: '28px',
          minWidth: '28px',
          borderRadius: '8px',
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '-0.01em',
        }}>
          {tenantConfig.brand_initial}
        </div>
        {!collapsed && (
          <span style={{
            fontWeight: 600,
            fontSize: '0.875rem',
            color: 'var(--ink)',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
          }}>
            {tenantConfig.company_name}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: '4px' }}>
        {NAV.map((section, si) => (
          <div key={si} style={{ marginBottom: si < NAV.length - 1 ? '4px' : 0 }}>

            {/* Section label */}
            {section.label && !collapsed && (
              <div style={{
                padding: '8px 8px 3px',
                fontSize: '0.625rem',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--ink-faint)',
                userSelect: 'none',
              }}>
                {section.label}
              </div>
            )}
            {section.label && collapsed && si > 0 && (
              <div style={{ height: '1px', background: 'var(--line)', margin: '4px 8px' }} />
            )}

            {/* Items */}
            {section.items.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    padding: collapsed ? '7px 0' : '7px 10px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    color: active ? 'var(--ink)' : 'var(--ink-muted)',
                    textDecoration: 'none',
                    fontSize: '0.8125rem',
                    fontWeight: active ? 500 : 400,
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    borderRadius: '8px',
                    borderLeft: active && !collapsed ? '2px solid var(--accent)' : '2px solid transparent',
                    paddingLeft: active && !collapsed ? '8px' : collapsed ? undefined : '10px',
                    transition: 'color 150ms ease, background 150ms ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                      e.currentTarget.style.color = 'var(--ink)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--ink-muted)'
                    }
                  }}
                >
                  <span style={{
                    display: 'flex',
                    flexShrink: 0,
                    color: active ? 'var(--accent)' : 'currentColor',
                    transition: 'color 150ms ease',
                  }}>
                    {item.icon}
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )
            })}
          </div>
        ))}

        {/* Settings */}
        <div style={{ marginTop: 'auto' }}>
          {!collapsed && <div style={{ height: '1px', background: 'var(--line)', margin: '4px 0 8px' }} />}
          {(() => {
            const active = isActive('/settings')
            return (
              <Link
                href="/settings"
                title={collapsed ? 'Settings' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  padding: collapsed ? '7px 0' : '7px 10px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  color: active ? 'var(--ink)' : 'var(--ink-muted)',
                  textDecoration: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: active ? 500 : 400,
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  borderRadius: '8px',
                  borderLeft: active && !collapsed ? '2px solid var(--accent)' : '2px solid transparent',
                  paddingLeft: active && !collapsed ? '8px' : collapsed ? undefined : '10px',
                  transition: 'color 150ms ease, background 150ms ease',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.color = 'var(--ink)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--ink-muted)'
                  }
                }}
              >
                <span style={{
                  display: 'flex',
                  flexShrink: 0,
                  color: active ? 'var(--accent)' : 'currentColor',
                }}>
                  <IconSettings />
                </span>
                {!collapsed && <span>Settings</span>}
              </Link>
            )
          })()}
        </div>
      </nav>

      {/* Bottom: sign out + collapse */}
      <div style={{ borderTop: '1px solid var(--line)', padding: '8px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <button
          onClick={handleSignOut}
          title="Sign out"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            padding: collapsed ? '7px 0' : '7px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--ink-muted)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            width: '100%',
            borderRadius: '8px',
            transition: 'color 150ms ease, background 150ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--negative-hex)'
            e.currentTarget.style.background = 'rgba(248, 113, 113, 0.08)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--ink-muted)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <span style={{ display: 'flex', flexShrink: 0 }}><IconLogOut /></span>
          {!collapsed && <span>Sign out</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            padding: collapsed ? '7px 0' : '7px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--ink-faint)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            width: '100%',
            borderRadius: '8px',
            transition: 'color 150ms ease, background 150ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--ink-muted)'
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--ink-faint)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <span style={{ display: 'flex', flexShrink: 0 }}>
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
