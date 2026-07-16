'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { fmtDateTime, fmtCurrency, fmtRate } from '@/lib/formatters'
import StarRating from '@/components/ui/StarRating'
import { tenantConfig } from '@/config/tenant.config'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import KPICard from '@/components/ui/KPICard'
import LoadingState from '@/components/ui/LoadingState'

interface Appointment {
  id: string
  scheduled_at: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  status: string | null
  outcome: string | null
  consultation_outcome: string | null
  treatment_value: number | null
  became_patient: boolean | null
  lead_quality_score: number | null
  appointment_notes: string | null
}

type Period = '7d' | '14d' | '30d' | '3m' | 'all'

const PERIODS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '14d', label: '14 days' },
  { value: '30d', label: '30 days' },
  { value: '3m', label: '3 months' },
  { value: 'all', label: 'All time' },
]

function periodCutoff(period: Period): Date | null {
  if (period === 'all') return null
  const now = new Date()
  if (period === '7d') return new Date(now.getTime() - 7 * 86400000)
  if (period === '14d') return new Date(now.getTime() - 14 * 86400000)
  if (period === '30d') return new Date(now.getTime() - 30 * 86400000)
  if (period === '3m') return new Date(now.getTime() - 90 * 86400000)
  return null
}

function computeKpis(appts: Appointment[]) {
  const showed = appts.filter(a => a.outcome === 'showed').length
  const noShow = appts.filter(a => a.outcome === 'no_show').length
  const treatmentTotal = appts.reduce((s, a) => s + (Number(a.treatment_value) || 0), 0)
  const becamePatient = appts.filter(a => a.became_patient).length
  const showRate = showed + noShow > 0 ? showed / (showed + noShow) : null
  return { total: appts.length, showed, noShow, showRate, treatmentTotal, becamePatient }
}

function monthLabel(isoDate: string) {
  return new Date(isoDate).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function rowBackground(appt: Appointment): string | undefined {
  const now = new Date()
  const date = appt.scheduled_at ? new Date(appt.scheduled_at) : null
  if (!date) return undefined
  if (date > now) return 'rgba(255,255,255,0.04)'
  const incomplete = !appt.outcome || !appt.consultation_outcome
  if (incomplete) return 'rgba(234,179,8,0.07)'
  return undefined
}

function AppointmentRow({
  appt,
  token,
  onSave,
}: {
  appt: Appointment
  token: string
  onSave: (id: string, updates: Partial<Appointment>) => Promise<void>
}) {
  const [outcome, setOutcome] = useState(appt.outcome ?? '')
  const [consultationOutcome, setConsultationOutcome] = useState(appt.consultation_outcome ?? '')
  const [treatmentValue, setTreatmentValue] = useState(appt.treatment_value?.toString() ?? '')
  const [becamePatient, setBecamePatient] = useState(appt.became_patient ?? false)
  const [leadQuality, setLeadQuality] = useState(appt.lead_quality_score ?? 0)
  const [notes, setNotes] = useState(appt.appointment_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const isDirty =
    outcome !== (appt.outcome ?? '') ||
    consultationOutcome !== (appt.consultation_outcome ?? '') ||
    treatmentValue !== (appt.treatment_value?.toString() ?? '') ||
    becamePatient !== (appt.became_patient ?? false) ||
    leadQuality !== (appt.lead_quality_score ?? 0) ||
    notes !== (appt.appointment_notes ?? '')

  const save = async () => {
    setSaving(true)
    try {
      await onSave(appt.id, {
        outcome: outcome || null,
        consultation_outcome: consultationOutcome || null,
        treatment_value: treatmentValue ? Number(treatmentValue) : null,
        became_patient: becamePatient,
        lead_quality_score: leadQuality || null,
        appointment_notes: notes || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr style={{ background: rowBackground(appt) }}>
      <td style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, color: 'var(--ink)', fontSize: '0.8125rem' }}>
          {appt.contact_name || '—'}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginTop: '1px' }}>
          {fmtDateTime(appt.scheduled_at)}
        </div>
      </td>
      <td>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="input-dark"
          style={{ fontSize: '0.75rem', padding: '3px 22px 3px 6px', width: '90px' }}
        >
          <option value="">—</option>
          <option value="showed">Showed</option>
          <option value="no_show">No-show</option>
        </select>
      </td>
      <td>
        <select
          value={consultationOutcome}
          onChange={(e) => setConsultationOutcome(e.target.value)}
          className="input-dark"
          style={{ fontSize: '0.75rem', padding: '3px 22px 3px 6px', width: '120px' }}
        >
          <option value="">—</option>
          <option value="Closed">Closed</option>
          <option value="Follow up">Follow up</option>
          <option value="Rescheduled">Rescheduled</option>
          <option value="Started Treatment">Started Tx</option>
          <option value="Pending Treatment">Pending Tx</option>
          <option value="No Sale">No Sale</option>
          <option value="Unqualified">Unqualified</option>
        </select>
      </td>
      <td>
        <input
          type="number"
          value={treatmentValue}
          onChange={(e) => setTreatmentValue(e.target.value)}
          placeholder="0"
          className="input-dark"
          style={{ fontSize: '0.75rem', padding: '3px 6px', width: '72px', textAlign: 'right' }}
        />
      </td>
      <td style={{ textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={becamePatient}
          onChange={(e) => setBecamePatient(e.target.checked)}
          style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--accent)' }}
        />
      </td>
      <td style={{ textAlign: 'center' }}>
        <StarRating value={leadQuality} onChange={setLeadQuality} />
      </td>
      <td>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes…"
          className="input-dark"
          style={{ fontSize: '0.75rem', padding: '3px 6px', width: '150px' }}
        />
      </td>
      <td style={{ whiteSpace: 'nowrap', paddingLeft: '8px' }}>
        {isDirty ? (
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '…' : 'Save'}
          </button>
        ) : saved ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--positive)' }}>✓</span>
        ) : null}
      </td>
    </tr>
  )
}

export default function PortalPage({ params }: { params: { token: string } }) {
  const [period, setPeriod] = useState<Period>('30d')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [clientName, setClientName] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/portal/${params.token}/appointments`)
      if (res.status === 404) { setNotFound(true); return }
      const data = await res.json()
      setClientName(data.clientName ?? null)
      setAppointments(data.appointments ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [params.token])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async (id: string, updates: Partial<Appointment>) => {
    const res = await fetch(`/api/portal/${params.token}/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
  }

  // KPIs filtered by selected period
  const kpis = useMemo(() => {
    const cutoff = periodCutoff(period)
    const filtered = cutoff
      ? appointments.filter(a => a.scheduled_at && new Date(a.scheduled_at) >= cutoff)
      : appointments
    return computeKpis(filtered)
  }, [appointments, period])

  // All appointments grouped by month, latest first
  const grouped = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const a of appointments) {
      const key = a.scheduled_at ? a.scheduled_at.slice(0, 7) : 'unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [appointments])

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--canvas)' }}>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.9375rem' }}>Portal link not found.</p>
      </div>
    )
  }

  const kpiCards = [
    { label: 'Consultations', value: kpis.total },
    { label: 'Showed', value: kpis.showed },
    { label: 'No-show', value: kpis.noShow },
    { label: 'Show Rate', value: kpis.showRate != null ? fmtRate(kpis.showRate) : '—' },
    { label: 'Treatment Value', value: kpis.treatmentTotal > 0 ? fmtCurrency(kpis.treatmentTotal) : '—' },
    { label: 'Became Patient', value: kpis.becamePatient },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--canvas)' }}>
      <header style={{
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--line)',
        padding: '0 2rem',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '7px',
            background: 'var(--accent)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff',
          }}>
            {tenantConfig.brand_initial}
          </div>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>
            {tenantConfig.company_name} Portal
          </span>
        </div>

        {/* Period selector — affects KPIs only */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid',
                borderColor: period === p.value ? 'var(--accent)' : 'var(--line-strong)',
                background: period === p.value ? 'var(--accent)' : 'transparent',
                color: period === p.value ? '#fff' : 'var(--ink-muted)',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <main style={{ padding: '2rem 2.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div className="animate-fade-up" style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {clientName ?? 'Loading…'}
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginTop: '0.25rem' }}>
            Review your consultations and mark outcomes
          </p>
        </div>

        {loading ? (
          <LoadingState center />
        ) : (
          <>
            {/* KPI row — period-filtered */}
            <div className="kpi-grid animate-fade-up delay-1" style={{ marginBottom: '2rem' }}>
              {kpiCards.map((card, i) => (
                <KPICard
                  key={card.label}
                  label={card.label}
                  value={String(card.value)}
                  delay={i + 1}
                  size="sm"
                />
              ))}
            </div>

            {/* All appointments grouped by month */}
            {grouped.length === 0 ? (
              <Panel>
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.875rem' }}>
                  No appointments yet
                </div>
              </Panel>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {grouped.map(([monthKey, appts]) => (
                  <Panel key={monthKey} className="animate-fade-up delay-2">
                    <PanelHeader
                      title={appts[0].scheduled_at ? monthLabel(appts[0].scheduled_at) : monthKey}
                      hint={`${appts.length} appointment${appts.length !== 1 ? 's' : ''}`}
                    />
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table-glass">
                        <thead>
                          <tr>
                            <th>Contact</th>
                            <th>Showed</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Treatment Value</th>
                            <th style={{ textAlign: 'center' }}>Patient</th>
                            <th style={{ textAlign: 'center' }}>Quality</th>
                            <th>Notes</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {appts.map((a) => (
                            <AppointmentRow key={a.id} appt={a} token={params.token} onSave={handleSave} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
