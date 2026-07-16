interface StatusDotProps {
  status: 'critical' | 'warn' | 'ok' | 'muted'
  label?: string
  size?: number
}

const COLOR_MAP: Record<StatusDotProps['status'], string> = {
  critical: 'var(--accent)',
  warn:     'var(--warn-hex)',
  ok:       'var(--positive-hex)',
  muted:    'var(--ink-faint)',
}

export default function StatusDot({ status, label, size = 8 }: StatusDotProps) {
  const color = COLOR_MAP[status]

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        display: 'inline-block',
        animation: status === 'critical' ? 'pulse-soft 1.6s ease-in-out infinite' : undefined,
      }} />
      {label && (
        <span style={{
          fontSize: '0.6875rem',
          fontWeight: 500,
          color,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          {label}
        </span>
      )}
    </span>
  )
}
