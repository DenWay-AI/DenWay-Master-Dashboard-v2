import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-line px-6 py-6 md:flex-row md:items-end md:justify-between md:px-8">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink md:text-2xl">{title}</h1>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
      )}
    </div>
  )
}

export function PageBody({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`px-6 py-6 md:px-8 ${className}`}>{children}</div>
}
