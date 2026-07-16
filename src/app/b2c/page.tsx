'use client'

import { useState, useEffect } from 'react'
import DateRangePicker from '@/components/DateRangePicker'
import ClientSelect from '@/components/ClientSelect'
import SyncStatusBadge from '@/components/SyncStatusBadge'
import AppointmentModal from '@/components/AppointmentModal'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import KPICard from '@/components/ui/KPICard'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { PageHeader, PageBody } from '@/components/ui/PageHeader'
import { fmtDateTime, fmtCurrency, fmtRate, fmtPct, fmtCurrencyDec } from '@/lib/formatters'

const OutcomeBadge = ({ outcome }: { outcome: string | null }) => {
  if (outcome === 'showed') return <span className="badge badge-success">Showed</span>
  if (outcome === 'no_show') return <span className="badge badge-danger">No-show</span>
  return <span className="badge badge-neutral">{outcome || '—'}</span>
}

const ConsultOutcomeBadge = ({ outcome }: { outcome: string | null }) => {
  if (!outcome) return <span className="text-ink-faint text-xs">—</span>
  if (outcome === 'Started Treatment') return <span className="badge badge-success">{outcome}</span>
  if (outcome === 'No Sale') return <span className="badge badge-danger">{outcome}</span>
  if (outcome === 'Unqualified') return <span className="badge badge-warning">{outcome}</span>
  return <span className="badge badge-neutral">{outcome}</span>
}

interface Appointment {
  id: string
  client: string | null
  rep: string | null
  contactName: string | null
  scheduledAt: string | null
  status: string | null
  outcome: string | null
  consultationOutcome: string | null
  treatmentValue: number | null
}

interface KPIs {
  total: number; showed: number; noShow: number
  showRate: number | null; treatmentTotal: number
}

export default function B2CPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 90)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [clientId, setClientId] = useState<string | undefined>(undefined)
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<unknown>(null)
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null)
  const [metaKpis, setMetaKpis] = useState<{ spend: number; leads: number; cpl: number | null; cpm: number | null; ctr: number | null } | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo, type: 'b2c', limit: '500', offset: '0', ...(clientId && { clientId }) })
      const adsParams = new URLSearchParams({ from: dateFrom, to: dateTo, ...(clientId && { clientId }) })
      const [kpisRes, apptRes, syncRes, adsRes] = await Promise.all([
        fetch(`/api/kpis?${params}`),
        fetch(`/api/appointments?${params}`),
        fetch('/api/sync-status'),
        fetch(`/api/ads?${adsParams}`),
      ])
      const [kpisData, apptData, syncData, adsData] = await Promise.all([
        kpisRes.json(), apptRes.json(), syncRes.json(), adsRes.json(),
      ])
      setKpis(kpisData)
      setAppointments(Array.isArray(apptData.appointments) ? apptData.appointments : [])
      setTotal(apptData.total ?? 0)
      setSyncStatus(syncData)
      if (adsData.totals) {
        const t = adsData.totals
        setMetaKpis({ spend: t.spend, leads: t.leads, cpl: t.cpl, cpm: t.cpm, ctr: t.ctr })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [dateFrom, dateTo, clientId])

  const coreKpiCards = kpis ? [
    { label: 'Consultations',   value: String(kpis.total) },
    { label: 'Showed',          value: String(kpis.showed) },
    { label: 'No-show',         value: String(kpis.noShow) },
    { label: 'Show Rate',       value: fmtRate(kpis.showRate) },
    { label: 'Treatment Value', value: fmtCurrency(kpis.treatmentTotal || null) },
  ] : []

  const adsKpiCards = metaKpis && (metaKpis.spend > 0 || metaKpis.leads > 0) ? [
    { label: 'Ad Spend', value: fmtCurrency(metaKpis.spend || null) },
    { label: 'Leads',    value: String(metaKpis.leads) },
    { label: 'CPL',      value: fmtCurrency(metaKpis.cpl) },
    { label: 'CPM',      value: fmtCurrencyDec(metaKpis.cpm) },
    { label: 'CTR',      value: fmtPct(metaKpis.ctr) },
  ] : []

  const allKpiCards = [...coreKpiCards, ...adsKpiCards]

  return (
    <>
      <PageHeader
        title="Consultations"
        subtitle="Patient appointments by client"
        actions={
          <>
            <SyncStatusBadge syncStatus={syncStatus as Parameters<typeof SyncStatusBadge>[0]['syncStatus']} onSyncComplete={fetchData} />
            <DateRangePicker from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
            <ClientSelect value={clientId} onChange={setClientId} />
          </>
        }
      />

      <PageBody>
        {loading ? (
          <LoadingState center />
        ) : (
          <>
            {allKpiCards.length > 0 && (
              <div className="kpi-grid animate-fade-up mb-8">
                {allKpiCards.map((c, i) => (
                  <KPICard key={c.label} label={c.label} value={c.value} delay={Math.min(i + 1, 7)} size="sm" />
                ))}
              </div>
            )}

            <div className="animate-fade-up delay-2">
              <Panel>
                <PanelHeader title="Appointments" hint={`${total} total`} />
                {appointments.length === 0 ? (
                  <EmptyState title="No consultations" description="Try a different date range or client." />
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table-glass">
                      <thead>
                        <tr>
                          <th>Contact</th>
                          <th>Date</th>
                          <th>Outcome</th>
                          <th>Consultation Result</th>
                          <th style={{ textAlign: 'right' }}>Treatment Value</th>
                          <th>Rep</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map(a => (
                          <tr key={a.id} onClick={() => setSelectedApptId(a.id)} style={{ cursor: 'pointer' }}>
                            <td className="font-medium">{a.contactName || '—'}</td>
                            <td className="text-ink-muted tnum">{fmtDateTime(a.scheduledAt)}</td>
                            <td><OutcomeBadge outcome={a.outcome} /></td>
                            <td><ConsultOutcomeBadge outcome={a.consultationOutcome} /></td>
                            <td style={{ textAlign: 'right', color: a.treatmentValue ? 'var(--ink)' : 'var(--ink-faint)', fontWeight: a.treatmentValue ? 600 : 400 }}>
                              {a.treatmentValue ? fmtCurrency(a.treatmentValue) : '—'}
                            </td>
                            <td className="text-ink-muted">{a.rep || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>
          </>
        )}
      </PageBody>

      <AppointmentModal
        appointmentId={selectedApptId}
        onClose={() => setSelectedApptId(null)}
        onSave={() => fetchData()}
      />
    </>
  )
}
