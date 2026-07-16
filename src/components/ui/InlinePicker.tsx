'use client'

import { useState, useRef, useEffect } from 'react'

export interface PickerOption {
  value: string | null
  label: string
  badgeClass?: string
  color?: string
}

interface InlinePickerProps {
  options: PickerOption[]
  value: string | null
  onSelect: (v: string | null) => void
  onOpenChange?: (open: boolean) => void
  // Custom trigger: if provided, renders it instead of the default badge/dash
  trigger?: (open: boolean) => React.ReactNode
  align?: 'left' | 'right'
}

export default function InlinePicker({
  options,
  value,
  onSelect,
  onOpenChange,
  trigger,
  align = 'left',
}: InlinePickerProps) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        onOpenChange?.(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onOpenChange])

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !open
    setOpen(next)
    onOpenChange?.(next)
  }

  const select = (v: string | null) => {
    setOpen(false)
    onOpenChange?.(false)
    if (v !== value) onSelect(v)
  }

  const selectedOpt = options.find((o) => o.value === value)

  const defaultTrigger = selectedOpt ? (
    selectedOpt.badgeClass ? (
      <span className={`badge ${selectedOpt.badgeClass}`}>{selectedOpt.label}</span>
    ) : (
      <span style={{ fontSize: '0.875rem', color: selectedOpt.color ?? 'hsl(var(--foreground))' }}>
        {selectedOpt.label}
      </span>
    )
  ) : (
    <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8125rem' }}>—</span>
  )

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div onClick={toggle} style={{ cursor: 'pointer' }}>
        {trigger ? trigger(open) : defaultTrigger}
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            [align]: 0,
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--card-border))',
            borderRadius: 'var(--radius)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 100,
            minWidth: '140px',
            overflow: 'hidden',
          }}
        >
          {options.map((opt) => {
            const key = opt.value ?? '__null__'
            const isActive = opt.value === value
            const isHovered = hovered === key
            return (
              <button
                key={key}
                onClick={(e) => { e.stopPropagation(); select(opt.value) }}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '0.45rem 0.875rem',
                  background: isActive
                    ? 'hsl(var(--brand) / 0.08)'
                    : isHovered
                    ? 'hsl(var(--surface-hover))'
                    : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background 100ms',
                }}
              >
                {opt.badgeClass ? (
                  <span className={`badge ${opt.badgeClass}`}>{opt.label}</span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      color: isActive
                        ? 'hsl(var(--brand))'
                        : opt.color ?? 'hsl(var(--foreground))',
                    }}
                  >
                    {opt.label}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
