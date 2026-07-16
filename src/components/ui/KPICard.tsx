import type { ReactNode } from 'react'

interface KPICardProps {
  label: string
  value: string | number
  sub?: string
  delta?: number | null
  lowerIsBetter?: boolean
  emphasis?: boolean
  size?: 'sm' | 'md' | 'lg'
  delay?: number
  icon?: ReactNode
  valueColor?: string
}

export default function KPICard({
  label,
  value,
  sub,
  delta,
  lowerIsBetter = false,
  emphasis = false,
  size = 'md',
  delay,
  icon,
  valueColor,
}: KPICardProps) {
  const delayClass = delay != null ? ` delay-${delay}` : ''
  const valueSize =
    size === 'sm' ? 'text-xl' : size === 'lg' ? 'text-3xl' : 'text-2xl'

  const good = delta != null && (lowerIsBetter ? delta < 0 : delta > 0)
  const bad  = delta != null && (lowerIsBetter ? delta > 0 : delta < 0)
  const deltaColor = good ? 'var(--positive)' : bad ? 'var(--negative)' : 'var(--ink-faint)'

  return (
    <div
      className={`animate-fade-up${delayClass} rounded-card bg-surface-1 shadow-panel px-5 py-4 ${
        emphasis ? 'border border-accent/40' : 'border border-line'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {icon && <span className="text-ink-faint">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`tnum ${valueSize} font-semibold tracking-tight`} style={{ color: valueColor ?? 'var(--ink)' }}>
          {String(value)}
        </span>
        {sub && <span className="text-xs text-ink-faint">{sub}</span>}
      </div>
      {delta != null && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="tnum text-xs font-medium" style={{ color: deltaColor }}>
            {delta > 0 ? '↑' : delta < 0 ? '↓' : '·'} {Math.abs(delta).toFixed(1)}%
          </span>
          <span className="text-[11px] text-ink-faint">vs last period</span>
        </div>
      )}
    </div>
  )
}
