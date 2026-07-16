'use client'

interface SegOption {
  value: string
  label: string
}

interface SegmentedControlProps {
  options: SegOption[]
  value: string
  onChange: (v: string) => void
}

export default function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--surface-2)',
      border: '1px solid var(--line-strong)',
      borderRadius: '8px',
      padding: '2px',
      gap: '2px',
    }}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: active ? 500 : 400,
              color: active ? 'var(--ink)' : 'var(--ink-muted)',
              background: active ? 'var(--surface-3)' : 'transparent',
              transition: 'all 150ms ease',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.25)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
