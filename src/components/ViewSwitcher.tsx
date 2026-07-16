'use client'

export interface SwitcherView {
  key: string
  label: string
  count?: number
}

interface ViewSwitcherProps {
  views: SwitcherView[]
  active: string
  onChange: (key: string) => void
}

export default function ViewSwitcher({ views, active, onChange }: ViewSwitcherProps) {
  return (
    <div
      className="inline-flex items-center gap-0.5 p-0.5 rounded-xl border border-line"
      style={{ background: 'var(--surface-2)' }}
    >
      {views.map(v => {
        const isActive = v.key === active
        return (
          <button
            key={v.key}
            onClick={() => onChange(v.key)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: isActive ? 'var(--surface-1)' : 'transparent',
              color: isActive ? 'var(--ink)' : 'var(--ink-faint)',
              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}
          >
            {v.label}
            {v.count !== undefined && (
              <span
                className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                style={{
                  background: isActive ? 'var(--accent)/15' : 'var(--surface-3)',
                  color: isActive ? 'var(--accent)' : 'var(--ink-faint)',
                }}
              >
                {v.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
