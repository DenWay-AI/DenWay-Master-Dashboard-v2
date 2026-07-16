interface DeltaProps {
  value: number | null
  lowerIsBetter?: boolean
  suffix?: string
}

export default function Delta({ value, lowerIsBetter = false, suffix = '%' }: DeltaProps) {
  if (value == null) return null

  const isGood = lowerIsBetter ? value < 0 : value > 0
  const isBad  = lowerIsBetter ? value > 0 : value < 0
  const color  = isGood ? 'var(--positive-hex)' : isBad ? 'var(--negative-hex)' : 'var(--ink-faint)'
  const arrow  = value > 0 ? '↑' : value < 0 ? '↓' : '·'

  return (
    <span style={{
      fontSize: '0.6875rem',
      fontWeight: 500,
      color,
      fontVariantNumeric: 'tabular-nums',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2px',
    }}>
      {arrow} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  )
}
