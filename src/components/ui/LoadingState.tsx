interface LoadingStateProps {
  label?: string
  center?: boolean
}

export default function LoadingState({
  label = 'Loading…',
  center = false,
}: LoadingStateProps) {
  return (
    <div
      className={`flex items-center gap-2.5 py-16 text-sm text-ink-muted ${
        center ? 'justify-center' : ''
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-soft" />
      {label}
    </div>
  )
}
