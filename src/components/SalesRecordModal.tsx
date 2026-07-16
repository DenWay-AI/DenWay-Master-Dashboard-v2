'use client'

import { useState, useEffect, useRef } from 'react'
import Modal from '@/components/Modal'
import StarRating from '@/components/ui/StarRating'
import { fmtDate } from '@/lib/formatters'

export interface SalesRecord {
  id: string
  airtable_record_id: string | null
  ghl_appointment_id: string | null
  fathom_url: string | null
  client_id: string | null
  clients?: { name: string } | null
  lead_name: string | null
  company_name: string | null
  owner_role: string | null
  email: string | null
  phone: string | null
  city: string | null
  country: string | null
  annual_rev: string | null
  website: string | null
  date_booked: string | null
  appointment_date: string | null
  show_status: string | null
  qualified: string | null
  lead_quality_score: number | null
  call_outcome: string | null
  deposit: boolean
  cash_collected: number | null
  contract_value: number | null
  offer: string | null
  notes: string | null
  objection: string | null
  closer: string | null
  set_type: string | null
  ad_name: string | null
  ad_set_name: string | null
  campaign_name: string | null
  month_key: string | null
}

export const SHOW_STATUS_OPTIONS = ['Showed', 'No Show', 'Cancelled', 'Reschedule']
export const QUALIFIED_OPTIONS = ['Qualified', 'Not Qualified']
export const OUTCOME_OPTIONS = ['Closed', 'Follow Up Booked', 'Follow Up', 'No Close', 'Disqualified', 'Long Term FU']
export const OBJECTION_OPTIONS = ['Money objection', 'Partner objection', 'Time objection', 'None - ready to go']

export const showStatusColor: Record<string, string> = {
  'Showed': 'badge-success',
  'No Show': 'badge-danger',
  'Cancelled': 'badge-danger',
  'Reschedule': 'badge-warning',
}
export const outcomeColor: Record<string, string> = {
  'Closed': 'badge-success',
  'Follow Up Booked': 'badge-warning',
  'Follow Up': 'badge-warning',
  'No Close': 'badge-danger',
  'Disqualified': 'badge-neutral',
  'Long Term FU': 'badge-info',
}
export const qualifiedColor: Record<string, string> = {
  'Qualified': 'badge-info',
  'Not Qualified': 'badge-neutral',
}
export const objectionColor: Record<string, string> = {
  'Money objection': 'badge-danger',
  'Partner objection': 'badge-warning',
  'Time objection': 'badge-warning',
  'None - ready to go': 'badge-success',
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  background: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 'var(--radius)',
  color: 'hsl(var(--foreground))',
  fontSize: '0.875rem',
  outline: 'none',
  width: '100%',
}
const labelStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: 'hsl(var(--muted-foreground))',
  marginBottom: '0.375rem',
  display: 'block',
}
const roStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'hsl(var(--foreground))',
}

// Form-styled picker for use inside modals (full-width, input-styled)
function FormPicker({
  options,
  value,
  badgeClass,
  onChange,
  placeholder = '— select —',
}: {
  options: string[]
  value: string | null
  badgeClass?: (v: string) => string
  onChange: (v: string | null) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.5rem 0.75rem',
          background: 'hsl(var(--background))',
          border: `1px solid ${open ? 'hsl(var(--brand))' : 'hsl(var(--border))'}`,
          borderRadius: 'var(--radius)',
          cursor: 'pointer', minHeight: '38px',
          transition: 'border-color 150ms',
        }}
      >
        {value ? (
          <span className={`badge ${badgeClass?.(value) ?? 'badge-neutral'}`}>{value}</span>
        ) : (
          <span style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>{placeholder}</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ color: 'hsl(var(--muted-foreground))', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'hsl(var(--card))', border: '1px solid hsl(var(--card-border))',
          borderRadius: 'var(--radius)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 200, overflow: 'hidden',
        }}>
          <button
            onClick={() => { onChange(null); setOpen(false) }}
            onMouseEnter={() => setHovered('__clear__')}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'block', width: '100%', padding: '0.5rem 0.875rem',
              background: hovered === '__clear__' ? 'hsl(var(--surface-hover))' : 'transparent',
              border: 'none', textAlign: 'left', cursor: 'pointer',
              fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))',
            }}
          >
            — clear —
          </button>
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false) }}
              onMouseEnter={() => setHovered(opt)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex', alignItems: 'center', width: '100%',
                padding: '0.5rem 0.875rem',
                background: opt === value ? 'hsl(var(--brand) / 0.08)' : hovered === opt ? 'hsl(var(--surface-hover))' : 'transparent',
                border: 'none', textAlign: 'left', cursor: 'pointer',
                transition: 'background 100ms',
              }}
            >
              <span className={`badge ${badgeClass?.(opt) ?? 'badge-neutral'}`}>{opt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface SalesRecordModalProps {
  record: SalesRecord | null
  onClose: () => void
  onSave: (updated: Partial<SalesRecord>) => void
}

export default function SalesRecordModal({ record, onClose, onSave }: SalesRecordModalProps) {
  const [form, setForm] = useState<Partial<SalesRecord>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (record) setForm({ ...record })
  }, [record?.id])

  if (!record) return null

  const set = (field: keyof SalesRecord, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const isDirty = JSON.stringify(form) !== JSON.stringify(record)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/sales-tracker', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id, ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage({ text: 'Saved', ok: true })
      onSave(form)
      setTimeout(() => setMessage(null), 2000)
    } catch (e: unknown) {
      setMessage({ text: e instanceof Error ? e.message : 'Error', ok: false })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={!!record} onClose={onClose} title={record.lead_name ?? 'Record'} width="720px">
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Contact Info */}
        <div>
          <p style={{ ...labelStyle, fontSize: '0.75rem', marginBottom: '0.75rem', color: 'hsl(var(--brand))' }}>CONTACT</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '1rem', background: 'hsl(var(--background))', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))' }}>
            <div><span style={labelStyle}>Lead Name</span><span style={roStyle}>{record.lead_name || '—'}</span></div>
            <div><span style={labelStyle}>Company</span><span style={roStyle}>{record.company_name || '—'}</span></div>
            <div><span style={labelStyle}>Owner / Role</span><span style={roStyle}>{record.owner_role || '—'}</span></div>
            <div><span style={labelStyle}>Annual Revenue</span><span style={roStyle}>{record.annual_rev || '—'}</span></div>
            <div><span style={labelStyle}>Email</span><span style={{ ...roStyle, fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>{record.email || '—'}</span></div>
            <div><span style={labelStyle}>Phone</span><span style={{ ...roStyle, fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>{record.phone || '—'}</span></div>
            <div><span style={labelStyle}>City</span><span style={{ ...roStyle, fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>{record.city || '—'}</span></div>
            <div><span style={labelStyle}>Country</span><span style={{ ...roStyle, fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>{record.country || '—'}</span></div>
            {record.website && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={labelStyle}>Website</span>
                <a href={record.website} target="_blank" rel="noreferrer" style={{ fontSize: '0.8125rem', color: 'hsl(var(--brand))' }}>{record.website}</a>
              </div>
            )}
          </div>
        </div>

        {/* Appointment Info */}
        <div>
          <p style={{ ...labelStyle, fontSize: '0.75rem', marginBottom: '0.75rem', color: 'hsl(var(--brand))' }}>APPOINTMENT</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '1rem', background: 'hsl(var(--background))', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))' }}>
            <div><span style={labelStyle}>Date Booked</span><span style={roStyle}>{fmtDate(record.date_booked)}</span></div>
            <div><span style={labelStyle}>Appointment Date</span><span style={roStyle}>{fmtDate(record.appointment_date)}</span></div>
            <div><span style={labelStyle}>Set Type</span><span style={roStyle}>{record.set_type || '—'}</span></div>
            <div><span style={labelStyle}>Ad Name</span><span style={{ ...roStyle, fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>{record.ad_name || '—'}</span></div>
            <div><span style={labelStyle}>Ad Set</span><span style={{ ...roStyle, fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>{record.ad_set_name || '—'}</span></div>
            <div><span style={labelStyle}>Campaign</span><span style={{ ...roStyle, fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>{record.campaign_name || '—'}</span></div>
          </div>
        </div>

        {/* Editable Sales Fields */}
        <div>
          <p style={{ ...labelStyle, fontSize: '0.75rem', marginBottom: '0.75rem', color: 'hsl(var(--brand))' }}>SALES OUTCOME</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Show Status</label>
              <FormPicker options={SHOW_STATUS_OPTIONS} value={form.show_status ?? null} badgeClass={(v) => showStatusColor[v] ?? 'badge-neutral'} onChange={(v) => set('show_status', v)} />
            </div>
            <div>
              <label style={labelStyle}>Qualified</label>
              <FormPicker options={QUALIFIED_OPTIONS} value={form.qualified ?? null} badgeClass={(v) => qualifiedColor[v] ?? 'badge-neutral'} onChange={(v) => set('qualified', v)} />
            </div>
            <div>
              <label style={labelStyle}>Call Outcome</label>
              <FormPicker options={OUTCOME_OPTIONS} value={form.call_outcome ?? null} badgeClass={(v) => outcomeColor[v] ?? 'badge-neutral'} onChange={(v) => set('call_outcome', v)} />
            </div>
            <div>
              <label style={labelStyle}>Objection</label>
              <FormPicker options={OBJECTION_OPTIONS} value={form.objection ?? null} badgeClass={(v) => objectionColor[v] ?? 'badge-neutral'} onChange={(v) => set('objection', v)} />
            </div>
            <div>
              <label style={labelStyle}>Cash Collected</label>
              <input type="number" className="input-dark" style={inputStyle} value={form.cash_collected ?? ''} onChange={(e) => set('cash_collected', e.target.value ? Number(e.target.value) : null)} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>Contract Value</label>
              <input type="number" className="input-dark" style={inputStyle} value={form.contract_value ?? ''} onChange={(e) => set('contract_value', e.target.value ? Number(e.target.value) : null)} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>Closer</label>
              <input type="text" className="input-dark" style={inputStyle} value={form.closer ?? ''} onChange={(e) => set('closer', e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>Offer / Pitch</label>
              <input type="text" className="input-dark" style={inputStyle} value={form.offer ?? ''} onChange={(e) => set('offer', e.target.value || null)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Notes</label>
              <textarea className="input-dark" style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'hsl(var(--foreground))' }}>
              <input
                type="checkbox"
                checked={!!form.deposit}
                onChange={(e) => set('deposit', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'hsl(var(--brand))', cursor: 'pointer' }}
              />
              Deposit paid
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ ...labelStyle, margin: 0 }}>Lead Quality</span>
              <StarRating value={form.lead_quality_score ?? 0} onChange={(v) => set('lead_quality_score', v)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', paddingTop: '0.5rem', borderTop: '1px solid hsl(var(--border))' }}>
          {message && (
            <span style={{ fontSize: '0.8125rem', color: message.ok ? 'hsl(var(--positive))' : 'hsl(var(--negative))' }}>
              {message.ok ? '✓ ' : '✕ '}{message.text}
            </span>
          )}
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', cursor: 'pointer' }}>
            Close
          </button>
          <button
            onClick={save}
            disabled={!isDirty || saving}
            style={{
              padding: '0.5rem 1.25rem',
              background: isDirty ? 'hsl(var(--brand))' : 'hsl(var(--border))',
              color: isDirty ? '#000' : 'hsl(var(--muted-foreground))',
              border: 'none', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 600,
              cursor: isDirty ? 'pointer' : 'default', opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
