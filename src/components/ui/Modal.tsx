import type { ReactNode, CSSProperties } from 'react'

interface ModalProps {
  onClose: () => void
  children: ReactNode
  maxWidth?: number
}

export function Modal({ onClose, children, maxWidth = 900 }: ModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth, maxHeight: '86vh',
          background: 'var(--surface-1)', border: '1px solid var(--line)',
          borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0, ...style }}>
      {children}
    </div>
  )
}

export function ModalBody({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px', ...style }}>
      {children}
    </div>
  )
}

export function ModalCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      style={{
        flexShrink: 0, background: 'transparent', border: 'none',
        cursor: 'pointer', fontSize: '1.2rem', color: 'var(--ink-faint)',
        lineHeight: 1, padding: '2px 6px',
      }}
    >
      ×
    </button>
  )
}
