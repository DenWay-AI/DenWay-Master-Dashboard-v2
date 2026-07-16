'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-hover px-4 py-2 shadow-[0_6px_20px_-8px_rgba(139,92,246,0.6)]',
  secondary:
    'border border-line-strong bg-surface-2 text-ink hover:bg-surface-3 px-4 py-2',
  ghost:
    'text-ink-muted hover:text-ink hover:bg-surface-2 px-3 py-1.5',
  danger:
    'border border-line-strong bg-surface-2 text-negative hover:bg-surface-2/80 px-4 py-2',
}

export default function Button({
  variant = 'secondary',
  className = '',
  children,
  ...props
}: {
  variant?: Variant
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}
