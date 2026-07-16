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
  const valueFontSize =
    size === 'sm' ? '1.25rem' : size === 'lg' ? '2rem' : '1.75rem'

  const good = delta != null && (lowerIsBetter ? delta < 0 : delta > 0)
  const bad  = delta != null && (lowerIsBetter ? delta > 0 : delta < 0)
  const deltaColor = good ? 'var(--positive)' : bad ? 'var(--negative)' : 'var(--ink-faint)'

  return (
    <div
      className={`glass-card animate-fade-up${delayClass}`}
      style={{
        padding: '18px 20px',
        borderColor: emphasis ? 'var(--card-border-hi)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="kpi-label">{label}</span>
        {icon && <span style={{ color: 'var(--ink-faint)' }}>{icon}</span>}
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          className="tnum"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: valueFontSize,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            color: valueColor ?? 'var(--ink)',
          }}
        >
          {String(value)}
        </span>
        {sub && <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>{sub}</span>}
      </div>
      {delta != null && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="tnum" style={{ fontSize: '0.75rem', fontWeight: 500, color: deltaColor }}>
            {delta > 0 ? '↑' : delta < 0 ? '↓' : '·'} {Math.abs(delta).toFixed(1)}%
          </span>
          <span style={{ fontSize: '0.6875rem', color: 'var(--ink-faint)' }}>vs last period</span>
        </div>
      )}
    </div>
  )
}
