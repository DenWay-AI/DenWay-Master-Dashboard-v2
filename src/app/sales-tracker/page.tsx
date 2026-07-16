'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Star, Video, ExternalLink, RefreshCw } from 'lucide-react'
import { Modal, ModalHeader, ModalBody, ModalCloseButton } from '@/components/ui/Modal'
import { PageHeader, PageBody } from '@/components/ui/PageHeader'
import KPICard from '@/components/ui/KPICard'
import InlinePicker from '@/components/ui/InlinePicker'
import { fmtCurrency } from '@/lib/formatters'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MeetingSlim {
  id: string
  scheduled_at: string | null
  show_status: string | null
  fathom_url: string | null
  fathom_title: string | null
  duration_seconds: number | null
  closer: string | null
  ghl_appointment_id: string | null
}

interface Lead {
  id: string
  lead_name: string | null
  company_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  country: string | null
  annual_rev: string | null
  website: string | null
  qualified: string | null
  lead_quality_score: number | null
  call_outcome: string | null
  offer: string | null
  objection: string | null
  notes: string | null
  deposit: boolean | null
  cash_collected: number | null
  contract_value: number | null
  ad_name: string | null
  ad_set_name: string | null
  campaign_name: string | null
  client_id: string | null
  clients: { name: string } | null
  meeting_count: number
  last_meeting_at: string | null
  last_show_status: string | null
  last_fathom_url: string | null
  meetings: MeetingSlim[]
}

interface LeadSlim {
  id: string
  lead_name: string | null
  company_name: string | null
  email: string | null
  phone: string | null
  qualified: string | null
  call_outcome: string | null
  contract_value: number | null
  cash_collected: number | null
  lead_quality_score: number | null
  ad_name: string | null
  ad_set_name: string | null
  campaign_name: string | null
}

interface Appointment {
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
  b2b_leads: LeadSlim | null
}

// ── Options ───────────────────────────────────────────────────────────────────

const QUALIFIED_OPTIONS = [
  { value: null,        label: '—' },
  { value: 'Yes',       label: 'Yes',      badgeClass: 'bg-emerald-50 text-emerald-700' },
  { value: 'No',        label: 'No',       badgeClass: 'bg-red-50 text-red-600' },
  { value: 'Pending',   label: 'Pending',  badgeClass: 'bg-amber-50 text-amber-700' },
]

const OUTCOME_OPTIONS = [
  { value: null,          label: '—' },
  { value: 'Closed',      label: 'Closed',      badgeClass: 'bg-emerald-50 text-emerald-700' },
  { value: 'Follow-up',   label: 'Follow-up',   badgeClass: 'bg-blue-50 text-blue-700' },
  { value: 'No Sale',     label: 'No Sale',     badgeClass: 'bg-zinc-100 text-zinc-600' },
  { value: 'Unqualified', label: 'Unqualified', badgeClass: 'bg-zinc-100 text-zinc-500' },
]

const SHOW_STATUS_OPTIONS = [
  { value: null,         label: '—' },
  { value: 'Showed',     label: 'Showed',     badgeClass: 'bg-emerald-50 text-emerald-700' },
  { value: 'No Show',    label: 'No Show',    badgeClass: 'bg-red-50 text-red-600' },
  { value: 'Cancelled',  label: 'Cancelled',  badgeClass: 'bg-zinc-100 text-zinc-600' },
  { value: 'Reschedule', label: 'Reschedule', badgeClass: 'bg-amber-50 text-amber-700' },
  { value: 'Pending',    label: 'Pending',    badgeClass: 'bg-blue-50 text-blue-600' },
]

const SHOW_STATUS_COLORS: Record<string, string> = {
  Showed:     'bg-emerald-50 text-emerald-700',
  'No Show':  'bg-red-50 text-red-600',
  Cancelled:  'bg-zinc-100 text-zinc-600',
  Reschedule: 'bg-amber-50 text-amber-700',
  Pending:    'bg-blue-50 text-blue-600',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
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

// ── Inline editing primitives ─────────────────────────────────────────────────

const editInputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface-2)', border: '1px solid var(--accent)',
  borderRadius: 4, color: 'var(--ink)', fontSize: '0.875rem',
  padding: '3px 6px', outline: 'none',
}

function InlineField({
  value, onSave, placeholder = 'Click to edit…', multiline = false,
}: {
  value: string | null
  onSave: (v: string | null) => void
  placeholder?: string
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  const open = () => { setDraft(value ?? ''); setEditing(true) }
  const save = () => { onSave(draft.trim() || null); setEditing(false) }
  const cancel = () => setEditing(false)

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  if (editing) {
    const props = {
      ref,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: save,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (!multiline && e.key === 'Enter') { e.preventDefault(); save() }
        if (e.key === 'Escape') { e.preventDefault(); cancel() }
      },
      style: { ...editInputStyle, ...(multiline ? { resize: 'vertical' as const, minHeight: 64 } : {}) },
    }
    return multiline ? <textarea rows={3} {...props} /> : <input {...props} />
  }

  return (
    <span
      onClick={open}
      style={{
        display: 'block', cursor: 'text', fontSize: '0.875rem',
        color: value ? 'var(--ink)' : 'var(--ink-faint)',
        padding: '3px 6px', borderRadius: 4,
        transition: 'background 100ms',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {value || placeholder}
    </span>
  )
}

function InlineCurrency({
  value, onSave, placeholder = 'Click to edit…',
}: {
  value: number | null
  onSave: (v: number | null) => void
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value != null ? String(value) : '')
  const ref = useRef<HTMLInputElement>(null)

  const open = () => { setDraft(value != null ? String(value) : ''); setEditing(true) }
  const save = () => {
    const n = parseFloat(draft.replace(/[^0-9.-]/g, ''))
    onSave(isNaN(n) ? null : n)
    setEditing(false)
  }

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save() } if (e.key === 'Escape') setEditing(false) }}
        style={editInputStyle}
      />
    )
  }

  return (
    <span
      onClick={open}
      style={{
        display: 'block', cursor: 'text', fontSize: '0.875rem',
        color: value != null ? 'var(--ink)' : 'var(--ink-faint)',
        padding: '3px 6px', borderRadius: 4,
        transition: 'background 100ms',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {value != null ? fmtCurrency(value) : placeholder}
    </span>
  )
}

function InlineToggle({ value, onSave }: { value: boolean | null; onSave: (v: boolean) => void }) {
  const checked = value === true
  return (
    <button
      onClick={() => onSave(!checked)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        background: 'transparent', border: 'none', padding: '3px 6px',
        borderRadius: 4, transition: 'background 100ms',
        fontSize: '0.875rem', color: checked ? 'var(--positive)' : 'var(--ink-faint)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{
        width: 14, height: 14, borderRadius: 3, border: `2px solid ${checked ? 'var(--positive)' : 'var(--line)'}`,
        background: checked ? 'var(--positive)' : 'transparent',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {checked && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
      </span>
      {checked ? 'Yes' : 'No'}
    </button>
  )
}

function ClickableStars({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value ?? 0
  return (
    <div style={{ display: 'flex', gap: 3, padding: '3px 6px', borderRadius: 4, cursor: 'pointer' }}
      onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i} size={15}
          className={i <= display ? 'text-amber-400 fill-amber-400' : 'text-line fill-transparent'}
          onMouseEnter={() => setHover(i)}
          onClick={() => onSave(value === i ? null : i)}
          style={{ cursor: 'pointer', transition: 'color 80ms' }}
        />
      ))}
    </div>
  )
}

// Always-visible row (shows even when empty so user can click to fill)
function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-1.5 border-b border-line last:border-0">
      <span className="w-32 shrink-0 text-xs text-ink-faint pt-1">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// Read-only row (hides when empty)
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex items-start gap-3 px-4 py-2 border-b border-line last:border-0">
      <span className="w-32 shrink-0 text-xs text-ink-faint">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  )
}

// ── Lead Modal ────────────────────────────────────────────────────────────────

function LeadModal({
  lead,
  onClose,
  onUpdate,
}: {
  lead: Lead
  onClose: () => void
  onUpdate: (id: string, patch: Partial<Lead>) => void
}) {
  // Local copy so edits reflect immediately without waiting for parent re-render
  const [local, setLocal] = useState<Lead>(lead)

  const patch = useCallback(
    async (fields: Partial<Lead>) => {
      setLocal(prev => ({ ...prev, ...fields }))
      onUpdate(lead.id, fields)
      await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, ...fields }),
      })
    },
    [lead.id, onUpdate],
  )

  const qualOpt = QUALIFIED_OPTIONS.find(o => o.value === local.qualified)
  const outOpt  = OUTCOME_OPTIONS.find(o => o.value === local.call_outcome)

  return (
    <Modal onClose={onClose} maxWidth={720}>
      <ModalHeader>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'var(--ink-faint)', marginBottom: 6 }}>
              Lead / Deal
            </div>
            {/* Editable company name as header title */}
            <InlineField
              value={local.company_name}
              onSave={v => patch({ company_name: v })}
              placeholder="Company name…"
            />
            <InlineField
              value={local.lead_name}
              onSave={v => patch({ lead_name: v })}
              placeholder="Contact name…"
            />
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>
      </ModalHeader>

      <ModalBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Deal ── */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Deal</p>

            {/* Pickers row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <p className="text-[10px] text-ink-faint mb-1">Outcome</p>
                <InlinePicker
                  options={OUTCOME_OPTIONS} value={local.call_outcome}
                  onSelect={v => patch({ call_outcome: v })}
                  trigger={() => outOpt?.badgeClass
                    ? <Badge label={outOpt.label} className={outOpt.badgeClass} />
                    : <span className="text-xs text-ink-faint cursor-pointer hover:text-ink">Set…</span>}
                />
              </div>
              <div>
                <p className="text-[10px] text-ink-faint mb-1">Qualified</p>
                <InlinePicker
                  options={QUALIFIED_OPTIONS} value={local.qualified}
                  onSelect={v => patch({ qualified: v })}
                  trigger={() => qualOpt?.badgeClass
                    ? <Badge label={qualOpt.label} className={qualOpt.badgeClass} />
                    : <span className="text-xs text-ink-faint cursor-pointer hover:text-ink">Set…</span>}
                />
              </div>
              <div>
                <p className="text-[10px] text-ink-faint mb-1">Quality</p>
                <ClickableStars value={local.lead_quality_score} onSave={v => patch({ lead_quality_score: v })} />
              </div>
            </div>

            <div className="rounded-lg border border-line divide-y divide-line bg-surface-2/30">
              <EditRow label="Contract value">
                <InlineCurrency value={local.contract_value} onSave={v => patch({ contract_value: v })} />
              </EditRow>
              <EditRow label="Cash collected">
                <InlineCurrency value={local.cash_collected} onSave={v => patch({ cash_collected: v })} />
              </EditRow>
              <EditRow label="Deposit paid">
                <InlineToggle value={local.deposit} onSave={v => patch({ deposit: v })} />
              </EditRow>
              <EditRow label="Offer">
                <InlineField value={local.offer} onSave={v => patch({ offer: v })} />
              </EditRow>
              <EditRow label="Objection">
                <InlineField value={local.objection} onSave={v => patch({ objection: v })} />
              </EditRow>
              <EditRow label="Notes">
                <InlineField value={local.notes} onSave={v => patch({ notes: v })} multiline />
              </EditRow>
            </div>
          </section>

          {/* ── Contact ── */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Contact</p>
            <div className="rounded-lg border border-line divide-y divide-line bg-surface-2/30">
              <EditRow label="Email">
                <InlineField value={local.email} onSave={v => patch({ email: v })} />
              </EditRow>
              <EditRow label="Phone">
                <InlineField value={local.phone} onSave={v => patch({ phone: v })} />
              </EditRow>
              <EditRow label="City">
                <InlineField value={local.city} onSave={v => patch({ city: v })} />
              </EditRow>
              <EditRow label="Country">
                <InlineField value={local.country} onSave={v => patch({ country: v })} />
              </EditRow>
              <EditRow label="Annual revenue">
                <InlineField value={local.annual_rev} onSave={v => patch({ annual_rev: v })} placeholder="e.g. 5M DKK" />
              </EditRow>
              <EditRow label="Website">
                {local.website ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <InlineField value={local.website} onSave={v => patch({ website: v })} />
                    <a
                      href={local.website.startsWith('http') ? local.website : `https://${local.website}`}
                      target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ color: 'var(--accent)', flexShrink: 0 }}
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                ) : (
                  <InlineField value={local.website} onSave={v => patch({ website: v })} placeholder="e.g. dentalclinic.dk" />
                )}
              </EditRow>
            </div>
          </section>

          {/* ── Attribution (read-only) ── */}
          {(local.ad_name || local.campaign_name || local.ad_set_name || local.clients) && (
            <section>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Attribution</p>
              <div className="rounded-lg border border-line divide-y divide-line bg-surface-2/30">
                <DetailRow label="Ad"       value={local.ad_name} />
                <DetailRow label="Ad set"   value={local.ad_set_name} />
                <DetailRow label="Campaign" value={local.campaign_name} />
                <DetailRow label="Client"   value={local.clients?.name} />
              </div>
            </section>
          )}

          {/* ── Appointments (read-only list) ── */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
              Appointments ({local.meetings.length})
            </p>
            {local.meetings.length === 0 ? (
              <p className="text-sm text-ink-faint">No appointments booked yet.</p>
            ) : (
              <div className="rounded-lg border border-line overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line bg-surface-2/50">
                      <th className="px-4 py-2 text-xs font-medium text-ink-faint">Date</th>
                      <th className="px-4 py-2 text-xs font-medium text-ink-faint">Show</th>
                      <th className="px-4 py-2 text-xs font-medium text-ink-faint">Closer</th>
                      <th className="px-4 py-2 text-xs font-medium text-ink-faint">Duration</th>
                      <th className="px-4 py-2 text-xs font-medium text-ink-faint">Recording</th>
                    </tr>
                  </thead>
                  <tbody>
                    {local.meetings.map(m => {
                      const sc = m.show_status ? SHOW_STATUS_COLORS[m.show_status] : null
                      return (
                        <tr key={m.id} className="border-b border-line last:border-0">
                          <td className="px-4 py-2.5 text-sm text-ink">{fmtDate(m.scheduled_at)}</td>
                          <td className="px-4 py-2.5">
                            {sc && m.show_status ? <Badge label={m.show_status} className={sc} /> : <span className="text-xs text-ink-faint">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-ink-muted">{m.closer ?? '—'}</td>
                          <td className="px-4 py-2.5 text-sm text-ink-muted tnum">{fmtDuration(m.duration_seconds) ?? '—'}</td>
                          <td className="px-4 py-2.5">
                            {m.fathom_url ? (
                              <a href={m.fathom_url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                                <Video size={12} /> Watch
                              </a>
                            ) : <span className="text-xs text-ink-faint">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </ModalBody>
    </Modal>
  )
}

// ── Appointment Modal ─────────────────────────────────────────────────────────

function AppointmentModal({
  appt,
  onClose,
  onUpdate,
}: {
  appt: Appointment
  onClose: () => void
  onUpdate: (id: string, patch: Partial<Appointment>) => void
}) {
  const [local, setLocal] = useState<Appointment>(appt)

  const patch = useCallback(async (fields: Partial<Appointment>) => {
    setLocal(prev => ({ ...prev, ...fields }))
    onUpdate(appt.id, fields)
    await fetch('/api/meetings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: appt.id, ...fields }),
    })
  }, [appt.id, onUpdate])

  const lead = local.b2b_leads
  const showOpt  = SHOW_STATUS_OPTIONS.find(o => o.value === local.show_status)
  const outOpt   = OUTCOME_OPTIONS.find(o => o.value === lead?.call_outcome)
  const qualOpt  = QUALIFIED_OPTIONS.find(o => o.value === lead?.qualified)

  return (
    <Modal onClose={onClose} maxWidth={580}>
      <ModalHeader>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'var(--ink-faint)', marginBottom: 4 }}>
              Appointment
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink)' }}>{fmtDate(local.scheduled_at)}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: 2 }}>
              {lead?.company_name || lead?.lead_name || 'Unmatched appointment'}
            </div>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>
      </ModalHeader>

      <ModalBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Appointment ── */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Appointment</p>
            <div className="rounded-lg border border-line divide-y divide-line bg-surface-2/30">
              <DetailRow label="Date" value={fmtDate(local.scheduled_at)} />
              <EditRow label="Show status">
                <InlinePicker
                  options={SHOW_STATUS_OPTIONS} value={local.show_status}
                  onSelect={v => patch({ show_status: v })}
                  trigger={() => showOpt?.badgeClass
                    ? <Badge label={showOpt.label} className={showOpt.badgeClass} />
                    : <span className="text-xs text-ink-faint cursor-pointer hover:text-ink">Set…</span>}
                />
              </EditRow>
              <EditRow label="Closer">
                <InlineField value={local.closer} onSave={v => patch({ closer: v })} />
              </EditRow>
              <DetailRow label="Duration" value={fmtDuration(local.duration_seconds)} />
              <EditRow label="Notes">
                <InlineField value={local.meeting_notes} onSave={v => patch({ meeting_notes: v })} multiline />
              </EditRow>
            </div>
          </section>

          {/* ── Fathom recording (read-only) ── */}
          {local.fathom_url && (
            <section>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Recording</p>
              <div className="rounded-lg border border-line bg-surface-2/30 p-4 flex items-start gap-3">
                <Video size={16} className="mt-0.5 shrink-0 text-accent" />
                <div className="flex-1 min-w-0">
                  {local.fathom_title && (
                    <p className="text-sm font-medium text-ink mb-1 truncate">{local.fathom_title}</p>
                  )}
                  <div className="flex items-center gap-3">
                    {local.duration_seconds && (
                      <span className="text-xs text-ink-muted tnum">{fmtDuration(local.duration_seconds)}</span>
                    )}
                    <a href={local.fathom_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium">
                      Watch recording <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Linked lead / deal (read-only) ── */}
          {lead && (
            <section>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Lead / Deal</p>
              <div className="rounded-lg border border-line divide-y divide-line bg-surface-2/30">
                <DetailRow label="Company"  value={lead.company_name} />
                <DetailRow label="Contact"  value={lead.lead_name} />
                <DetailRow label="Email"    value={lead.email} />
                <DetailRow label="Phone"    value={lead.phone} />
                <DetailRow label="Qualified" value={
                  qualOpt?.badgeClass ? <Badge label={qualOpt.label} className={qualOpt.badgeClass} /> : null
                } />
                <DetailRow label="Outcome" value={
                  outOpt?.badgeClass ? <Badge label={outOpt.label} className={outOpt.badgeClass} /> : null
                } />
                <DetailRow label="Quality" value={
                  lead.lead_quality_score != null ? (
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} size={11}
                          className={i <= (lead.lead_quality_score ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-line fill-transparent'} />
                      ))}
                    </div>
                  ) : null
                } />
                <DetailRow label="Contract" value={lead.contract_value ? fmtCurrency(lead.contract_value) : null} />
                <DetailRow label="Cash"     value={lead.cash_collected ? fmtCurrency(lead.cash_collected) : null} />
              </div>
            </section>
          )}

          {/* ── Attribution (read-only) ── */}
          {lead && (lead.ad_name || lead.campaign_name) && (
            <section>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Attribution</p>
              <div className="rounded-lg border border-line divide-y divide-line bg-surface-2/30">
                <DetailRow label="Ad"       value={lead.ad_name} />
                <DetailRow label="Ad set"   value={lead.ad_set_name} />
                <DetailRow label="Campaign" value={lead.campaign_name} />
              </div>
            </section>
          )}
        </div>
      </ModalBody>
    </Modal>
  )
}

// ── Leads Table ───────────────────────────────────────────────────────────────

function LeadsTable({ leads, onUpdate }: { leads: Lead[]; onUpdate: (id: string, patch: Partial<Lead>) => void }) {
  const [modalLead, setModalLead] = useState<Lead | null>(null)

  const patchLead = useCallback((id: string, fields: Partial<Lead>) => {
    onUpdate(id, fields)
    fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    })
  }, [onUpdate])

  return (
    <>
      <div className="rounded-card border border-line bg-surface-1 shadow-panel overflow-x-auto">
        <table className="w-full min-w-[960px] text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="py-3 px-4 text-xs font-medium text-ink-faint">Company / Contact</th>
              <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Outcome</th>
              <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Qualified</th>
              <th className="py-3 pr-4 text-xs font-medium text-ink-faint text-center">Appts</th>
              <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Last call</th>
              <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Quality</th>
              <th className="py-3 pr-4 text-xs font-medium text-ink-faint text-right">Contract</th>
              <th className="py-3 pr-4 text-xs font-medium text-ink-faint text-right">Cash</th>
              <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Ad</th>
              <th className="py-3 pr-4 text-xs font-medium text-ink-faint text-center">Rec</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr><td colSpan={10} className="py-12 text-center text-sm text-ink-faint">No leads found.</td></tr>
            )}
            {leads.map(lead => {
              const qualOpt   = QUALIFIED_OPTIONS.find(o => o.value === lead.qualified)
              const outOpt    = OUTCOME_OPTIONS.find(o => o.value === lead.call_outcome)
              const showColor = lead.last_show_status ? SHOW_STATUS_COLORS[lead.last_show_status] : null
              return (
                <tr key={lead.id}
                  className="border-b border-line hover:bg-surface-2/60 cursor-pointer transition-colors"
                  onClick={() => setModalLead(lead)}>
                  <td className="py-3 px-4">
                    <p className="text-sm font-medium text-ink leading-tight">{lead.company_name || lead.lead_name || '—'}</p>
                    {lead.company_name && lead.lead_name && (
                      <p className="text-xs text-ink-muted mt-0.5">{lead.lead_name}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4" onClick={e => e.stopPropagation()}>
                    <InlinePicker options={OUTCOME_OPTIONS} value={lead.call_outcome}
                      onSelect={v => patchLead(lead.id, { call_outcome: v })}
                      trigger={() => outOpt?.badgeClass
                        ? <Badge label={outOpt.label} className={outOpt.badgeClass} />
                        : <span className="text-xs text-ink-faint">—</span>} />
                  </td>
                  <td className="py-3 pr-4" onClick={e => e.stopPropagation()}>
                    <InlinePicker options={QUALIFIED_OPTIONS} value={lead.qualified}
                      onSelect={v => patchLead(lead.id, { qualified: v })}
                      trigger={() => qualOpt?.badgeClass
                        ? <Badge label={qualOpt.label} className={qualOpt.badgeClass} />
                        : <span className="text-xs text-ink-faint">—</span>} />
                  </td>
                  <td className="py-3 pr-4 text-center">
                    <span className={`text-xs font-medium ${lead.meeting_count > 0 ? 'text-ink' : 'text-ink-faint'}`}>
                      {lead.meeting_count > 0 ? lead.meeting_count : '—'}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="text-xs text-ink-muted">{fmtDate(lead.last_meeting_at)}</p>
                    {showColor && lead.last_show_status && (
                      <Badge label={lead.last_show_status} className={`mt-0.5 ${showColor}`} />
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} size={11}
                          className={i <= (lead.lead_quality_score ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-line fill-transparent'} />
                      ))}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="tnum text-sm text-ink">{lead.contract_value ? fmtCurrency(lead.contract_value) : '—'}</span>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="tnum text-sm text-ink">{lead.cash_collected ? fmtCurrency(lead.cash_collected) : '—'}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs text-ink-muted truncate max-w-[120px] block" title={lead.ad_name ?? undefined}>
                      {lead.ad_name ?? '—'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-center">
                    {lead.last_fathom_url ? (
                      <a href={lead.last_fathom_url} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center justify-center rounded-md p-1 text-ink-faint hover:text-accent hover:bg-accent-soft transition-colors">
                        <Video size={14} />
                      </a>
                    ) : (
                      <span className="text-ink-faint opacity-30"><Video size={14} /></span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modalLead && (
        <LeadModal
          lead={modalLead}
          onClose={() => setModalLead(null)}
          onUpdate={(id, patch) => {
            onUpdate(id, patch)
            setModalLead(prev => prev ? { ...prev, ...patch } : null)
          }}
        />
      )}
    </>
  )
}

// ── Appointments Table ────────────────────────────────────────────────────────

function AppointmentsTable({
  appointments,
  onUpdate,
}: {
  appointments: Appointment[]
  onUpdate: (id: string, patch: Partial<Appointment>) => void
}) {
  const [modalAppt, setModalAppt] = useState<Appointment | null>(null)

  return (
    <>
      <div className="rounded-card border border-line bg-surface-1 shadow-panel overflow-x-auto">
        <table className="w-full min-w-[700px] text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-3 text-xs font-medium text-ink-faint">Date</th>
              <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Lead / Company</th>
              <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Show</th>
              <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Outcome</th>
              <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Closer</th>
              <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Duration</th>
              <th className="py-3 pr-4 text-xs font-medium text-ink-faint">Recording</th>
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-ink-faint">No appointments yet.</td></tr>
            )}
            {appointments.map(appt => {
              const lead     = appt.b2b_leads
              const showColor = appt.show_status ? SHOW_STATUS_COLORS[appt.show_status] : null
              const outOpt   = OUTCOME_OPTIONS.find(o => o.value === lead?.call_outcome)
              return (
                <tr key={appt.id}
                  className="border-b border-line hover:bg-surface-2/60 cursor-pointer transition-colors"
                  onClick={() => setModalAppt(appt)}>
                  <td className="px-4 py-3 text-sm text-ink">{fmtDate(appt.scheduled_at)}</td>
                  <td className="py-3 pr-4">
                    {!appt.lead_id ? (
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
                  <td className="py-3 pr-4">
                    {showColor && appt.show_status
                      ? <Badge label={appt.show_status} className={showColor} />
                      : <span className="text-xs text-ink-faint">—</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {outOpt?.badgeClass
                      ? <Badge label={outOpt.label} className={outOpt.badgeClass} />
                      : <span className="text-xs text-ink-faint">—</span>}
                  </td>
                  <td className="py-3 pr-4 text-sm text-ink-muted">{appt.closer ?? '—'}</td>
                  <td className="py-3 pr-4 text-sm text-ink-muted tnum">{fmtDuration(appt.duration_seconds) ?? '—'}</td>
                  <td className="py-3 pr-4">
                    {appt.fathom_url ? (
                      <a href={appt.fathom_url} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                        <Video size={13} /> Watch
                      </a>
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modalAppt && (
        <AppointmentModal
          appt={modalAppt}
          onClose={() => setModalAppt(null)}
          onUpdate={(id, patch) => {
            onUpdate(id, patch)
            setModalAppt(prev => prev ? { ...prev, ...patch } : null)
          }}
        />
      )}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'leads' | 'appointments'

type SyncState = 'idle' | 'running' | 'done' | 'error'

export default function SalesTrackerPage() {
  const [tab, setTab] = useState<Tab>('leads')
  const [leads, setLeads] = useState<Lead[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncMsg, setSyncMsg] = useState('')

  const loadData = useCallback(() => {
    return Promise.all([
      fetch('/api/leads').then(r => r.json()),
      fetch('/api/meetings').then(r => r.json()),
    ]).then(([ld, ap]) => {
      setLeads(ld.leads ?? [])
      setAppointments(ap.meetings ?? [])
    })
  }, [])

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [loadData])

  const handleSync = useCallback(async () => {
    setSyncState('running')
    setSyncMsg('')
    try {
      const res = await fetch('/api/sync/b2b-appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysBack: 730, daysForward: 30 }),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) {
        setSyncState('error')
        setSyncMsg(data.error ?? 'Sync failed')
        return
      }
      setSyncState('done')
      setSyncMsg(`Synced ${data.eventsFound ?? 0} appointments → ${data.upserted ?? 0} saved`)
      await loadData()
    } catch (e) {
      setSyncState('error')
      setSyncMsg(e instanceof Error ? e.message : 'Sync failed')
    }
  }, [loadData])

  const handleLeadUpdate = useCallback((id: string, patch: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }, [])

  const handleApptUpdate = useCallback((id: string, patch: Partial<Appointment>) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
  }, [])

  const filteredLeads = leads.filter(l => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      l.company_name?.toLowerCase().includes(q) ||
      l.lead_name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.call_outcome?.toLowerCase().includes(q) ||
      l.ad_name?.toLowerCase().includes(q)
    )
  })

  const filteredAppts = appointments.filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    const lead = a.b2b_leads
    return (
      lead?.company_name?.toLowerCase().includes(q) ||
      lead?.lead_name?.toLowerCase().includes(q) ||
      a.closer?.toLowerCase().includes(q) ||
      a.fathom_title?.toLowerCase().includes(q)
    )
  })

  const total    = leads.length
  const closed   = leads.filter(l => l.call_outcome === 'Closed').length
  const pipeline = leads
    .filter(l => l.call_outcome !== 'Closed' && l.call_outcome !== 'No Sale' && l.call_outcome !== 'Unqualified')
    .reduce((s, l) => s + (l.contract_value ?? 0), 0)
  const cashIn   = leads.reduce((s, l) => s + (l.cash_collected ?? 0), 0)
  const showed   = appointments.filter(a => a.show_status === 'Showed').length

  return (
    <>
      <PageHeader
        title="Sales Tracker"
        subtitle="Leads are deals — one per practice, multiple appointments"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncState === 'running'}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors ${
                syncState === 'running'
                  ? 'border-line text-ink-faint bg-surface-2 cursor-not-allowed'
                  : syncState === 'error'
                  ? 'border-red-300 text-red-600 bg-red-50 hover:bg-red-100'
                  : syncState === 'done'
                  ? 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                  : 'border-line text-ink-muted bg-surface-1 hover:bg-surface-2 hover:text-ink'
              }`}
              title={syncMsg || 'Pull all appointments from GHL (last 2 years)'}
            >
              <RefreshCw
                size={12}
                className={syncState === 'running' ? 'animate-spin' : ''}
              />
              {syncState === 'running' ? 'Syncing…' : syncState === 'done' ? 'Synced' : syncState === 'error' ? 'Sync failed' : 'Sync GHL'}
            </button>
            {syncMsg && (
              <span className={`text-xs ${syncState === 'error' ? 'text-red-500' : 'text-ink-faint'}`}>
                {syncMsg}
              </span>
            )}
            <input
              type="search"
              placeholder={tab === 'leads' ? 'Search leads…' : 'Search appointments…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 w-56 rounded-lg border border-line bg-surface-1 px-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        }
      />

      <PageBody>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KPICard label="Total leads"    value={total} />
          <KPICard label="Closed"         value={closed} />
          <KPICard label="Open pipeline"  value={fmtCurrency(pipeline)} />
          <KPICard label="Cash collected" value={fmtCurrency(cashIn)} />
          <KPICard label={`Appointments (${showed} showed)`} value={appointments.length} />
        </div>

        <div className="mb-4 flex gap-1 border-b border-line">
          {(['leads', 'appointments'] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setSearch('') }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-accent text-accent' : 'border-transparent text-ink-muted hover:text-ink'
              }`}>
              {t === 'leads' ? `Leads (${leads.length})` : `Appointments (${appointments.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-ink-faint">Loading…</p>
        ) : tab === 'leads' ? (
          <>
            <LeadsTable leads={filteredLeads} onUpdate={handleLeadUpdate} />
            <p className="mt-3 text-xs text-ink-faint">
              {filteredLeads.length} of {total} leads{search && ` matching "${search}"`}
            </p>
          </>
        ) : (
          <>
            <AppointmentsTable appointments={filteredAppts} onUpdate={handleApptUpdate} />
            <p className="mt-3 text-xs text-ink-faint">
              {filteredAppts.length} of {appointments.length} appointments{search && ` matching "${search}"`}
            </p>
          </>
        )}
      </PageBody>
    </>
  )
}
