'use client'

import { useEffect, useState } from 'react'
import Modal from './Modal'

type Call = {
  id: string
  recording_id: string
  title: string | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  participants: any[] | null
  transcript: any | null
  has_transcript: boolean
  fathom_url: string | null
  category: string
  category_override: boolean
}

type Props = {
  callId: string | null
  onClose: () => void
  onSave: (updated: Call) => void
}

const CATEGORIES = [
  { value: 'sales_call', label: 'Sales Call' },
  { value: 'other', label: 'Other' },
  { value: 'uncategorized', label: 'Uncategorized' },
]

function formatDuration(seconds: number | null) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const label: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'hsl(var(--muted-foreground))',
  marginBottom: '0.25rem',
}

const value: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'hsl(var(--foreground))',
}

export default function CallModal({ callId, onClose, onSave }: Props) {
  const [call, setCall] = useState<Call | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [category, setCategory] = useState('uncategorized')
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (!callId) { setCall(null); return }
    setLoading(true)
    fetch(`/api/fathom/calls/${callId}`)
      .then(r => r.json())
      .then(data => {
        setCall(data)
        setCategory(data.category ?? 'uncategorized')
      })
      .finally(() => setLoading(false))
  }, [callId])

  async function saveCategory() {
    if (!call) return
    setSaving(true)
    const res = await fetch(`/api/fathom/calls/${call.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setCall(updated)
      onSave(updated)
      setMsg({ text: 'Saved', ok: true })
      setTimeout(() => setMsg(null), 2000)
    } else {
      setMsg({ text: 'Save failed', ok: false })
      setTimeout(() => setMsg(null), 3000)
    }
  }

  const dirty = call && category !== call.category

  return (
    <Modal open={!!callId} onClose={onClose} title={call?.title ?? 'Call Detail'} width="720px">
      {loading && (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
          Loading…
        </div>
      )}

      {!loading && call && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Meta row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <div style={label}>Date</div>
              <div style={value}>{formatDate(call.started_at)}</div>
            </div>
            <div>
              <div style={label}>Duration</div>
              <div style={value}>{formatDuration(call.duration_seconds)}</div>
            </div>
            <div>
              <div style={label}>Recording</div>
              <div style={value}>
                {call.fathom_url
                  ? <a href={call.fathom_url} target="_blank" rel="noreferrer" style={{ color: 'hsl(var(--brand))' }}>Open in Fathom ↗</a>
                  : '—'}
              </div>
            </div>
          </div>

          {/* Participants */}
          {call.participants && call.participants.length > 0 && (
            <div>
              <div style={label}>Participants</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                {call.participants.map((p: any, i: number) => (
                  <span key={i} style={{
                    fontSize: '0.8rem',
                    padding: '0.2rem 0.6rem',
                    background: 'hsl(var(--muted))',
                    borderRadius: '999px',
                    color: 'hsl(var(--foreground))',
                  }}>
                    {p.display_name ?? p.name ?? p.email ?? p.matched_calendar_invitee_email ?? String(p)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Category */}
          <div>
            <div style={label}>Category</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  fontSize: '0.875rem',
                }}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {dirty && (
                <button
                  onClick={saveCategory}
                  disabled={saving}
                  style={{
                    padding: '0.4rem 1rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'hsl(var(--brand))',
                    color: '#fff',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              )}
              {msg && (
                <span style={{ fontSize: '0.8rem', color: msg.ok ? 'hsl(142 71% 45%)' : 'hsl(0 72% 51%)' }}>
                  {msg.text}
                </span>
              )}
            </div>
          </div>

          {/* Transcript */}
          <div>
            <div style={label}>Transcript</div>
            {!call.has_transcript && (
              <div style={{ ...value, color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>
                No transcript available
              </div>
            )}
            {call.has_transcript && call.transcript && (
              <div style={{
                marginTop: '0.5rem',
                maxHeight: '340px',
                overflowY: 'auto',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                padding: '1rem',
                fontSize: '0.8125rem',
                lineHeight: 1.6,
                color: 'hsl(var(--foreground))',
                background: 'hsl(var(--muted) / 0.3)',
              }}>
                {Array.isArray(call.transcript)
                  ? call.transcript.map((chunk: any, i: number) => (
                    <div key={i} style={{ marginBottom: '0.75rem' }}>
                      {chunk.speaker && (
                        <span style={{ fontWeight: 600, color: 'hsl(var(--brand))' }}>
                          {chunk.speaker?.display_name ?? chunk.speaker?.name ?? String(chunk.speaker)}:{' '}
                        </span>
                      )}
                      {chunk.text ?? chunk.content ?? JSON.stringify(chunk)}
                    </div>
                  ))
                  : <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {typeof call.transcript === 'string'
                        ? call.transcript
                        : JSON.stringify(call.transcript, null, 2)}
                    </pre>
                }
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
