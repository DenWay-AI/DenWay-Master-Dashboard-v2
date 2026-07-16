interface MonogramProps {
  name: string
  size?: number
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

export default function Monogram({ name, size = 36 }: MonogramProps) {
  const initials = getInitials(name)
  const fontSize = Math.round(size * 0.37)
  const radius = Math.round(size * 0.28)

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      minWidth: size,
      borderRadius: radius,
      background: 'var(--accent-soft)',
      border: '1px solid var(--accent-border)',
      color: 'var(--accent)',
      fontSize,
      fontWeight: 600,
      flexShrink: 0,
      userSelect: 'none',
      lineHeight: 1,
      letterSpacing: '-0.01em',
    }}>
      {initials}
    </span>
  )
}
