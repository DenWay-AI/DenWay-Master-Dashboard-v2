'use client'

import { useState, useEffect } from 'react'
import Modal from './Modal'
import { fmtDateTime } from '@/lib/formatters'
import StarRating from '@/components/ui/StarRating'

interface Appointment {
  id: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  scheduled_at: string | null
  status: string | null
  outcome: string | null
  consultation_outcome: string | null
  treatment_value: number | null
  became_patient: boolean | null
  lead_quality_score: number | null
  rep?: string | null
  client?: string | null
}

interface AppointmentModalProps {
  appointmentId: string | null
  onClose: () => void
  onSave?: (updated: Partial<Appointment>) => void
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

export default function AppointmentModal({ appointmentId, onClose, onSave }: AppointmentModalProps) {
  const [appt, setAppt] = useState<Appointment | null>(null)
  const [form, setForm] = useState<Partial<Appointment>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (!appointmentId) return
    setLoading(true)
    fetch(`/api/appointments/${appointmentId}`)
      .then(r => r.json())
      .then(d => {
        // API returns snake_case from DB, map to our interface
        const mapped: Appointment = {
          id: d.id,
          contact_name: d.contact_name,
          contact_email: d.contact_email,
          contact_phone: d.contact_phone,
          scheduled_at: d.scheduled_at,
          status: d.status,
          outcome: d.outcome,
          consultation_outcome: d.consultation_outcome,
          treatment_value: d.treatment_value,
          became_patient: d.became_patient,
          lead_quality_score: d.lead_quality_score,
        }
        setAppt(mapped)
        setForm(mapped)
        setLoading(false)
      })
  }, [appointmentId])

  const set = (field: keyof Appointment, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const isDirty = JSON.stringify(form) !== JSON.stringify(appt)

  const save = async () => {
    if (!appointmentId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAppt(form as Appointment)
      setMessage({ text: 'Saved', ok: true })
      onSave?.(form)
      setTimeout(() => setMessage(null), 2000)
    } catch (e: unknown) {
      setMessage({ text: e instanceof Error ? e.message : 'Error', ok: false })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!appointmentId}
      onClose={onClose}
      title={loading ? 'Loading…' : (appt?.contact_name ?? 'Appointment')}
      width="580px"
    >
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
          Loading…
        </div>
      ) : appt && (
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Read-only info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '1rem', background: 'hsl(var(--background))', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))' }}>
            <div>
              <span style={labelStyle}>Date</span>
              <span style={{ fontSize: '0.875rem', color: 'hsl(var(--foreground))' }}>{fmtDateTime(appt.scheduled_at)}</span>
            </div>
            <div>
              <span style={labelStyle}>Contact</span>
              <span style={{ fontSize: '0.875rem', color: 'hsl(var(--foreground))' }}>{appt.contact_name || '—'}</span>
            </div>
            {appt.contact_email && (
              <div>
                <span style={labelStyle}>Email</span>
                <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>{appt.contact_email}</span>
              </div>
            )}
            {appt.contact_phone && (
              <div>
                <span style={labelStyle}>Phone</span>
                <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>{appt.contact_phone}</span>
              </div>
            )}
          </div>

          {/* Editable fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="input-dark" style={inputStyle} value={form.status ?? ''} onChange={e => set('status', e.target.value || null)}>
                <option value="">—</option>
                <option value="booked">Booked</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No-show</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Outcome</label>
              <select className="input-dark" style={inputStyle} value={form.outcome ?? ''} onChange={e => set('outcome', e.target.value || null)}>
                <option value="">Pending</option>
                <option value="showed">Showed</option>
                <option value="no_show">No-show</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Consultation Result</label>
              <select className="input-dark" style={inputStyle} value={form.consultation_outcome ?? ''} onChange={e => set('consultation_outcome', e.target.value || null)}>
                <option value="">—</option>
                <option value="Started Treatment">Started Treatment</option>
                <option value="No Sale">No Sale</option>
                <option value="Unqualified">Unqualified</option>
                <option value="Follow-up">Follow-up</option>
                <option value="Rescheduled">Rescheduled</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Treatment Value</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>$</span>
                <input
                  type="number"
                  className="input-dark"
                  style={{ ...inputStyle, flex: 1 }}
                  value={form.treatment_value ?? ''}
                  onChange={e => set('treatment_value', e.target.value ? Number(e.target.value) : null)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'hsl(var(--foreground))' }}>
              <input
                type="checkbox"
                checked={!!form.became_patient}
                onChange={e => set('became_patient', e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'hsl(var(--brand))', cursor: 'pointer' }}
              />
              Became Patient
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ ...labelStyle, margin: 0 }}>Lead Quality</span>
              <StarRating value={form.lead_quality_score ?? 0} onChange={v => set('lead_quality_score', v)} />
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', paddingTop: '0.5rem', borderTop: '1px solid hsl(var(--border))' }}>
            {message && (
              <span style={{ fontSize: '0.8125rem', color: message.ok ? 'hsl(var(--positive))' : 'hsl(var(--negative))' }}>
                {message.ok ? '✓ ' : '✕ '}{message.text}
              </span>
            )}
            <button
              onClick={onClose}
              style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', cursor: 'pointer' }}
            >
              Close
            </button>
            <button
              onClick={save}
              disabled={!isDirty || saving}
              style={{
                padding: '0.5rem 1.25rem',
                background: isDirty ? 'hsl(var(--brand))' : 'hsl(var(--border))',
                color: isDirty ? 'hsl(var(--brand-foreground))' : 'hsl(var(--muted-foreground))',
                border: 'none', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 600,
                cursor: isDirty ? 'pointer' : 'default', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
