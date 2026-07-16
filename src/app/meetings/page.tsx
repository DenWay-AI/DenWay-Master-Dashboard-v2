'use client'

import { useState, useEffect, useCallback } from 'react'
import { Video, Link2 } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/ui/PageHeader'
import InlinePicker from '@/components/ui/InlinePicker'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MeetingLead {
  id: string
  lead_name: string | null
  company_name: string | null
  email: string | null
}

interface Meeting {
  id: string
  lead_id: string | null
  ghl_appointment_id: string | null
  scheduled_at: string | null
  show_status: string | null
  closer: string | null
  meeting_notes: string | null
  fathom_recording_id: string | null
  fathom_url: string | null
  fathom_title: string | null
  duration_seconds: number | null
  b2b_leads: MeetingLead | null
}

// ── Options ───────────────────────────────────────────────────────────────────

const SHOW_STATUS_OPTIONS = [
  { value: null,         label: '—' },
  { value: 'Showed',     label: 'Showed',     badgeClass: 'bg-emerald-50 text-emerald-700' },
  { value: 'No Show',    label: 'No Show',    badgeClass: 'bg-red-50 text-red-600' },
  { value: 'Cancelled',  label: 'Cancelled',  badgeClass: 'bg-zinc-100 text-zinc-600' },
  { value: 'Reschedule', label: 'Reschedule', badgeClass: 'bg-amber-50 text-amber-700' },
  { value: 'Pending',    label: 'Pending',    badgeClass: 'bg-blue-50 text-blue-600' },
]

const FILTER_OPTIONS = ['All', 'Showed', 'No Show', 'Reschedule', 'Unmatched'] as const
type Filter = (typeof FILTER_OPTIONS)[number]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function fmtDuration(secs: number | null) {
  if (!secs) return null
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function MeetingRow({
  meeting,
  onUpdate,
}: {
  meeting: Meeting
  onUpdate: (id: string, patch: Partial<Meeting>) => void
}) {
  const patch = useCallback(
    async (fields: Partial<Meeting>) => {
      onUpdate(meeting.id, fields)
      await fetch('/api/meetings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: meeting.id, ...fields }),
      })
    },
    [meeting.id, onUpdate],
  )

  const lead = meeting.b2b_leads
  const isUnmatched = !meeting.lead_id
  const statusOpt = SHOW_STATUS_OPTIONS.find(o => o.value === meeting.show_status)

  return (
    <tr className="border-b border-line hover:bg-surface-2/60 transition-colors">
      {/* Date */}
      <td className="py-3 px-4">
        <span className="text-sm text-ink">{fmtDate(meeting.scheduled_at)}</span>
      </td>

      {/* Lead / Company */}
      <td className="py-3 pr-4">
        {isUnmatched ? (
          <Badge label="Unmatched" className="bg-amber-50 text-amber-700" />
        ) : (
          <div>
            <p className="text-sm font-medium text-ink leading-tight">
              {lead?.company_name || lead?.lead_name || '—'}
            </p>
            {lead?.company_name && lead?.lead_name && (
              <p className="text-xs text-ink-muted mt-0.5">{lead.lead_name}</p>
            )}
          </div>
        )}
      </td>

      {/* Show status */}
      <td className="py-3 pr-4">
        <InlinePicker
          options={SHOW_STATUS_OPTIONS}
          value={meeting.show_status}
          onSelect={v => patch({ show_status: v })}
          trigger={() =>
            statusOpt?.badgeClass ? (
              <Badge label={statusOpt.label} className={statusOpt.badgeClass} />
            ) : (
              <span className="text-xs text-ink-faint">—</span>
            )
          }
        />
      </td>

      {/* Closer */}
      <td className="py-3 pr-4">
        <span className="text-sm text-ink-muted">{meeting.closer ?? '—'}</span>
      </td>

      {/* Duration */}
      <td className="py-3 pr-4">
        <span className="tnum text-sm text-ink-muted">
          {fmtDuration(meeting.duration_seconds) ?? '—'}
        </span>
      </td>

      {/* Recording */}
      <td className="py-3 pr-4">
        {meeting.fathom_url ? (
          <a
            href={meeting.fathom_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
            title={meeting.fathom_title ?? undefined}
          >
            <Video size={13} />
            Watch
          </a>
        ) : (
          <span className="text-xs text-ink-faint">No recording</span>
        )}
      </td>

      {/* Link to lead (for unmatched) */}
      <td className="py-3 pr-4">
        {isUnmatched && (
          <button
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-accent transition-colors"
            title="Link to a lead (coming soon)"
            disabled
          >
            <Link2 size={12} />
            Link
          </button>
        )}
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/meetings')
      .then(r => r.json())
      .then(d => setMeetings((d.meetings ?? []).filter((m: Meeting) => m.fathom_url)))
      .finally(() => setLoading(false))
  }, [])

  const handleUpdate = useCallback((id: string, patch: Partial<Meeting>) => {
    setMeetings(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)))
  }, [])

  const filtered = meetings.filter(m => {
    if (filter === 'Unmatched') return !m.lead_id
    if (filter !== 'All' && m.show_status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        m.b2b_leads?.company_name?.toLowerCase().includes(q) ||
        m.b2b_leads?.lead_name?.toLowerCase().includes(q) ||
        m.fathom_title?.toLowerCase().includes(q) ||
        m.closer?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const showed    = meetings.filter(m => m.show_status === 'Showed').length
  const noShow    = meetings.filter(m => m.show_status === 'No Show').length
  const unmatched = meetings.filter(m => !m.lead_id).length
  const withRec   = meetings.filter(m => m.fathom_url).length

  return (
    <>
      <PageHeader
        title="Fathom Calls"
        subtitle="All recorded calls with Fathom"
        actions={
          <input
            type="search"
            placeholder="Search meetings…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 w-48 rounded-lg border border-line bg-surface-1 px-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-accent"
          />
        }
      />

      <PageBody>
        {/* Summary strip */}
        <div className="mb-5 flex flex-wrap items-center gap-4 text-sm">
          <span className="text-ink-muted">
            <span className="font-medium text-ink">{meetings.length}</span> total
          </span>
          <span className="text-emerald-600 font-medium">{showed} showed</span>
          <span className="text-red-500 font-medium">{noShow} no-show</span>
          <span className="text-ink-muted">{withRec} with recording</span>
        </div>

        {/* Filter tabs */}
        <div className="mb-4 flex gap-1">
          {FILTER_OPTIONS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-accent text-white'
                  : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
              }`}
            >
              {f}
              {f === 'Unmatched' && unmatched > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  filter === f ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                }`}>
                  {unmatched}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-card border border-line bg-surface-1 shadow-panel overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-3 text-xs font-medium text-ink-faint">Date</th>
                <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Lead / Company</th>
                <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Show status</th>
                <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Closer</th>
                <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Duration</th>
                <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Recording</th>
                <th className="py-3 pr-4" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-ink-faint">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-ink-faint">
                    {search ? 'No meetings match your search.' : 'No meetings yet.'}
                  </td>
                </tr>
              )}
              {filtered.map(m => (
                <MeetingRow key={m.id} meeting={m} onUpdate={handleUpdate} />
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-ink-faint">
          {filtered.length} of {meetings.length} meetings
        </p>
      </PageBody>
    </>
  )
}
