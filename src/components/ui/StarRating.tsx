'use client'

interface StarRatingProps {
  value: number | null
  onChange: (v: number) => void
  size?: 'sm' | 'md'
  readonly?: boolean
}

export default function StarRating({ value, onChange, size = 'md', readonly = false }: StarRatingProps) {
  const fontSize = size === 'sm' ? '1rem' : '1.1rem'

  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={readonly ? undefined : () => onChange(star === value ? 0 : star)}
          disabled={readonly}
          title={readonly ? undefined : `${star} star${star !== 1 ? 's' : ''}`}
          style={{
            background: 'none',
            border: 'none',
            cursor: readonly ? 'default' : 'pointer',
            padding: '2px',
            fontSize,
            color: star <= (value ?? 0) ? '#f59e0b' : 'rgba(255,255,255,0.15)',
            transition: 'color 100ms ease',
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}
