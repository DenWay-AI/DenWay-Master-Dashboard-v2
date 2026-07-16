'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutGrid,
  TrendingUp,
  Users2,
  Video,
  Megaphone,
  Users,
  Calendar,
  LineChart,
  Headphones,
  Settings,
  Menu,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { tenantConfig } from '@/config/tenant.config'

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  matchPrefix?: string
}

const navMain: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutGrid },
]

const navB2B: NavItem[] = [
  { label: 'Pipeline',      href: '/b2b',            icon: TrendingUp },
  { label: 'Sales Tracker', href: '/sales-tracker',  icon: Users2, matchPrefix: '/sales-tracker' },
  { label: 'Fathom Calls',  href: '/meetings',       icon: Video },
  { label: 'B2B Ads',       href: '/b2b-ads',        icon: Megaphone },
]

const navB2C: NavItem[] = [
  { label: 'Clients',       href: '/clients',      icon: Users,      matchPrefix: '/clients' },
  { label: 'Consultations', href: '/b2c',           icon: Calendar },
  { label: 'B2C Ads',       href: '/ads',           icon: LineChart },
  { label: 'Call Center',   href: '/call-center',   icon: Headphones },
]

const navSystem: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings },
]

function isActive(pathname: string, item: NavItem): boolean {
  if (item.matchPrefix) return pathname.startsWith(item.matchPrefix)
  return pathname === item.href
}

function NavLink({
  item,
  pathname,
  onClick,
}: {
  item: NavItem
  pathname: string
  onClick?: () => void
}) {
  const active = isActive(pathname, item)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? 'bg-accent-soft text-ink'
          : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
      }`}
    >
      <Icon
        size={17}
        className={active ? '' : 'text-ink-faint group-hover:text-ink-muted'}
        style={active ? { color: 'var(--accent)' } : undefined}
      />
      <span className="font-medium">{item.label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
    </Link>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-3 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string
  onNavigate?: () => void
}) {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
          {tenantConfig.brand_initial}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold tracking-tight text-ink">
            {tenantConfig.company_name}
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            {tenantConfig.tagline}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        <Group label="Main">
          {navMain.map(item => (
            <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavigate} />
          ))}
        </Group>
        <Group label="B2B">
          {navB2B.map(item => (
            <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavigate} />
          ))}
        </Group>
        <Group label="B2C">
          {navB2C.map(item => (
            <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavigate} />
          ))}
        </Group>
        <Group label="System">
          {navSystem.map(item => (
            <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavigate} />
          ))}
        </Group>
      </nav>

      {/* Sign out */}
      <div className="border-t border-line px-3 py-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <LogOut size={16} className="text-ink-faint" />
          Sign out
        </button>
      </div>
    </div>
  )
}

const STANDALONE_PATHS = ['/login', '/portal']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (STANDALONE_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return <div className="relative z-10 min-h-screen">{children}</div>
  }

  return (
    <div className="relative z-10 flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 border-r border-line bg-surface-1/60 backdrop-blur lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[260px] border-r border-line bg-surface-1 shadow-pop animate-fade-up">
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile topbar */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">
              {tenantConfig.brand_initial}
            </span>
            <span className="text-sm font-semibold text-ink">{tenantConfig.company_name}</span>
          </span>
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
