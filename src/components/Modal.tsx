'use client'

import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  width?: string
  children: React.ReactNode
}

export default function Modal({ open, onClose, title, width = '640px', children }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--card-border))',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: width,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px -12px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        {title && (
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid hsl(var(--border))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
              margin: 0,
            }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'hsl(var(--muted-foreground))',
                cursor: 'pointer',
                fontSize: '1.25rem',
                lineHeight: 1,
                padding: '0.25rem',
                borderRadius: '4px',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Body */}
        <div style={{ overflow: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
