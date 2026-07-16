'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import CallModal from '@/components/CallModal'

type B2BRecord = {
  id: string
  lead_name: string | null
  company_name: string | null
  email: string | null
  show_status: string | null
  call_outcome: string | null
  closer: string | null
  deposit: boolean
  cash_collected: number | null
  contract_value: number | null
  lead_quality_score: number | null
  objection: string | null
}

type Call = {
  id: string
  recording_id: string
  title: string | null
  started_at: string | null
  duration_seconds: number | null
  has_transcript: boolean
  fathom_url: string | null
  category: string
  category_override: boolean
  b2b_tracker_id: string | null
  b2b_sales_tracker: B2BRecord | null
}

const CATEGORY_ORDER = ['sales_call', 'other', 'uncategorized']

const CATEGORY_LABELS: Record<string, string> = {
  sales_call: 'Sales Calls',
  other: 'Other',
  uncategorized: 'Uncategorized',
}

const OUTCOME_COLORS: Record<string, string> = {
  'Closed':            'hsl(142 71% 45%)',
  'Follow Up Booked':  'hsl(43 96% 56%)',
  'Follow Up':         'hsl(43 96% 56%)',
  'No Close':          'hsl(0 72% 51%)',
  'Disqualified':      'hsl(215 20% 65%)',
  'Long Term FU':      'hsl(200 80% 55%)',
}

const SHOW_COLORS: Record<string, string> = {
  'Showed':     'hsl(142 71% 45%)',
  'No Show':    'hsl(0 72% 51%)',
  'Cancelled':  'hsl(0 72% 51%)',
  'Reschedule': 'hsl(43 96% 56%)',
}

function Badge({ text, color }: { text: string; color?: string }) {
  return (
    <span style={{
      fontSize: '0.7rem',
      fontWeight: 500,
      padding: '0.15rem 0.5rem',
      borderRadius: '999px',
      background: (color ?? 'hsl(215 20% 65%)') + '22',
      color: color ?? 'hsl(215 20% 65%)',
      whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  )
}

function formatDuration(s: number | null) {
  if (!s) return '—'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function SalesCallRow({ call, onClick }: { call: Call; onClick: () => void }) {
  const b2b = call.b2b_sales_tracker
  const displayName = b2b?.lead_name ?? call.title ?? '(untitled)'
  const company = b2b?.company_name ?? null

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 110px 100px 120px 120px 60px',
        padding: '0.7rem 1rem',
        borderBottom: '1px solid hsl(var(--border))',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        alignItems: 'center',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--muted) / 0.3)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ overflow: 'hidden', paddingRight: '1rem' }}>
        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </div>
        {company && (
          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.1rem' }}>
            {company}
          </div>
        )}
      </div>
      <div style={{ color: 'hsl(var(--muted-foreground))' }}>{formatDate(call.started_at)}</div>
      <div style={{ color: 'hsl(var(--muted-foreground))' }}>{formatDuration(call.duration_seconds)}</div>
      <div>
        {b2b?.show_status
          ? <Badge text={b2b.show_status} color={SHOW_COLORS[b2b.show_status]} />
          : <span style={{ color: 'hsl(var(--muted-foreground))' }}>—</span>}
      </div>
      <div>
        {b2b?.call_outcome
          ? <Badge text={b2b.call_outcome} color={OUTCOME_COLORS[b2b.call_outcome]} />
          : <span style={{ color: 'hsl(var(--muted-foreground))' }}>—</span>}
      </div>
      <div style={{ color: call.has_transcript ? 'hsl(142 71% 45%)' : 'hsl(var(--muted-foreground))' }}>
        {call.has_transcript ? '✓' : '—'}
      </div>
    </div>
  )
}

function GenericCallRow({ call, onClick }: { call: Call; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 110px 100px 1fr 60px',
        padding: '0.7rem 1rem',
        borderBottom: '1px solid hsl(var(--border))',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        alignItems: 'center',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--muted) / 0.3)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '1rem', fontWeight: 500 }}>
        {call.title ?? '(untitled)'}
      </div>
      <div style={{ color: 'hsl(var(--muted-foreground))' }}>{formatDate(call.started_at)}</div>
      <div style={{ color: 'hsl(var(--muted-foreground))' }}>{formatDuration(call.duration_seconds)}</div>
      <div />
      <div style={{ color: call.has_transcript ? 'hsl(142 71% 45%)' : 'hsl(var(--muted-foreground))' }}>
        {call.has_transcript ? '✓' : '—'}
      </div>
    </div>
  )
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  async function fetchCalls() {
    setLoading(true)
    const res = await fetch('/api/fathom/calls')
    const data = await res.json()
    setCalls(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchCalls() }, [])

  async function syncNow() {
    setSyncing(true)
    setSyncMsg(null)
    const res = await fetch('/api/fathom/sync', { method: 'POST' })
    const data = await res.json()
    setSyncing(false)
    if (res.ok) {
      setSyncMsg(`Synced ${data.inserted ?? 0} calls, ${data.transcriptsFetched ?? 0} transcripts`)
      fetchCalls()
    } else {
      setSyncMsg(`Error: ${data.error}`)
    }
    setTimeout(() => setSyncMsg(null), 5000)
  }

  function handleSave(updated: any) {
    setCalls(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
  }

  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    calls: calls.filter(c => c.category === cat),
  })).filter(g => g.calls.length > 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Calls</h1>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
              {calls.length} total
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {syncMsg && <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>{syncMsg}</span>}
            <button
              onClick={syncNow}
              disabled={syncing}
              style={{
                padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none',
                background: 'hsl(var(--brand))', color: '#fff', fontSize: '0.875rem',
                fontWeight: 500, cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.7 : 1,
              }}
            >
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {grouped.map(({ category, label, calls: groupCalls }) => (
              <div key={category}>
                <h2 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
                  {label} <span style={{ fontWeight: 400 }}>({groupCalls.length})</span>
                </h2>

                <div style={{ border: '1px solid hsl(var(--border))', borderRadius: '8px', overflow: 'hidden' }}>
                  {/* Column headers */}
                  {category === 'sales_call' ? (
                    <div style={{
                      display: 'grid', gridTemplateColumns: '2fr 110px 100px 120px 120px 60px',
                      padding: '0.5rem 1rem', background: 'hsl(var(--muted) / 0.4)',
                      borderBottom: '1px solid hsl(var(--border))', fontSize: '0.7rem',
                      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: 'hsl(var(--muted-foreground))',
                    }}>
                      <div>Lead / Company</div>
                      <div>Date</div>
                      <div>Duration</div>
                      <div>Show</div>
                      <div>Outcome</div>
                      <div>Transcript</div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid', gridTemplateColumns: '2fr 110px 100px 1fr 60px',
                      padding: '0.5rem 1rem', background: 'hsl(var(--muted) / 0.4)',
                      borderBottom: '1px solid hsl(var(--border))', fontSize: '0.7rem',
                      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: 'hsl(var(--muted-foreground))',
                    }}>
                      <div>Title</div>
                      <div>Date</div>
                      <div>Duration</div>
                      <div />
                      <div>Transcript</div>
                    </div>
                  )}

                  {groupCalls.map(call =>
                    category === 'sales_call'
                      ? <SalesCallRow key={call.id} call={call} onClick={() => setSelectedId(call.id)} />
                      : <GenericCallRow key={call.id} call={call} onClick={() => setSelectedId(call.id)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <CallModal
          callId={selectedId}
          onClose={() => setSelectedId(null)}
          onSave={handleSave}
        />
      </main>
    </div>
  )
}
