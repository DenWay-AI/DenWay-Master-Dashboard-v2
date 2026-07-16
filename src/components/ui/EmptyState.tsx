import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && (
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface-3 text-ink-faint">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && (
        <p className="max-w-[280px] text-xs leading-relaxed text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
