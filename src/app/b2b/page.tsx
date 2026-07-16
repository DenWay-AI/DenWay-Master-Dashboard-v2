'use client'

import { useState, useEffect } from 'react'
import DateRangePicker from '@/components/DateRangePicker'
import LoadingState from '@/components/ui/LoadingState'
import KPICard from '@/components/ui/KPICard'
import { fmtCurrency, fmtRate, fmtDate } from '@/lib/formatters'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import EmptyState from '@/components/ui/EmptyState'
import { PageHeader, PageBody } from '@/components/ui/PageHeader'

interface SalesRecord {
  id: string
  lead_name: string | null
  company_name: string | null
  appointment_date: string | null
  show_status: string | null
  qualified: string | null
  call_outcome: string | null
  cash_collected: number | null
  contract_value: number | null
  closer: string | null
  clients?: { name: string } | null
}

const outcomeColor: Record<string, string> = {
  'Closed':           'badge-success',
  'Follow Up Booked': 'badge-warning',
  'Follow Up':        'badge-warning',
  'No Close':         'badge-danger',
  'Disqualified':     'badge-neutral',
  'Long Term FU':     'badge-info',
}
const showColor: Record<string, string> = {
  'Showed':     'badge-success',
  'No Show':    'badge-danger',
  'Cancelled':  'badge-danger',
  'Reschedule': 'badge-warning',
}

export default function B2BPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 90)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [records, setRecords] = useState<SalesRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams({ from: dateFrom, to: dateTo })
    fetch(`/api/sales-tracker?${params}`)
      .then(r => r.json())
      .then(d => { setRecords(Array.isArray(d.records) ? d.records : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [dateFrom, dateTo])

  const total         = records.length
  const showed        = records.filter(r => r.show_status === 'Showed').length
  const noShow        = records.filter(r => r.show_status === 'No Show' || r.show_status === 'Cancelled').length
  const showRate      = total > 0 ? showed / total : null
  const closed        = records.filter(r => r.call_outcome === 'Closed').length
  const closeRate     = showed > 0 ? closed / showed : null
  const cashTotal     = records.reduce((s, r) => s + (r.cash_collected ?? 0), 0)
  const contractTotal = records.reduce((s, r) => s + (r.contract_value ?? 0), 0)
  const pipelineOpen  = records
    .filter(r => r.call_outcome && ['Follow Up', 'Follow Up Booked', 'Long Term FU'].includes(r.call_outcome))
    .reduce((s, r) => s + (r.contract_value ?? 0), 0)

  const byMonth = records.reduce<Record<string, { booked: number; showed: number; closed: number; cash: number }>>((acc, r) => {
    const key = r.appointment_date ? r.appointment_date.slice(0, 7) : 'Unknown'
    if (!acc[key]) acc[key] = { booked: 0, showed: 0, closed: 0, cash: 0 }
    acc[key].booked++
    if (r.show_status === 'Showed') acc[key].showed++
    if (r.call_outcome === 'Closed') acc[key].closed++
    acc[key].cash += r.cash_collected ?? 0
    return acc
  }, {})

  const monthRows = Object.entries(byMonth)
    .filter(([k]) => k !== 'Unknown')
    .sort(([a], [b]) => b.localeCompare(a))

  const recentClosed = records.filter(r => r.call_outcome === 'Closed').slice(0, 8)

  const funnelStages = [
    { label: 'Booked',    value: total,   color: 'var(--accent)' },
    { label: 'Showed',    value: showed,  color: 'var(--positive)' },
    { label: 'Qualified', value: records.filter(r => r.qualified === 'Qualified').length, color: '#60a5fa' },
    { label: 'Closed',    value: closed,  color: 'var(--positive)' },
    { label: 'No Show',   value: noShow,  color: 'var(--negative)' },
  ]

  const kpiCards = [
    { label: 'Booked',         value: total },
    { label: 'Showed',         value: showed },
    { label: 'Show Rate',      value: fmtRate(showRate) },
    { label: 'Closed',         value: closed },
    { label: 'Close Rate',     value: fmtRate(closeRate) },
    { label: 'Cash Collected', value: fmtCurrency(cashTotal || null) },
    { label: 'Contract Total', value: fmtCurrency(contractTotal || null) },
    { label: 'Open Pipeline',  value: fmtCurrency(pipelineOpen || null) },
  ]

  return (
    <>
      <PageHeader
        title="B2B Overview"
        subtitle="Sales pipeline performance — ads to closed deals"
        actions={
          <DateRangePicker from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        }
      />

      <PageBody>
        {loading ? (
          <LoadingState center />
        ) : total === 0 ? (
          <EmptyState title="No data for this period" description="No sales calls found. Sync from GHL or adjust the date range." />
        ) : (
          <>
            <div className="kpi-grid animate-fade-up mb-8">
              {kpiCards.map((card, i) => (
                <KPICard key={card.label} label={card.label} value={String(card.value)} delay={Math.min(i + 1, 7)} size="sm" />
              ))}
            </div>

            <div className="animate-fade-up delay-2 mb-4 grid grid-cols-2 gap-4">
              <Panel>
                <PanelHeader title="Monthly Breakdown" />
                {monthRows.length === 0 ? (
                  <EmptyState title="No monthly data" />
                ) : (
                  <table className="table-glass">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th style={{ textAlign: 'right' }}>Booked</th>
                        <th style={{ textAlign: 'right' }}>Showed</th>
                        <th style={{ textAlign: 'right' }}>Closed</th>
                        <th style={{ textAlign: 'right' }}>Cash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthRows.map(([month, d]) => (
                        <tr key={month}>
                          <td className="font-medium">
                            {new Date(month + '-01').toLocaleString('en-US', { month: 'short', year: 'numeric' })}
                          </td>
                          <td style={{ textAlign: 'right' }}>{d.booked}</td>
                          <td style={{ textAlign: 'right' }}>{d.showed}</td>
                          <td style={{ textAlign: 'right', color: d.closed > 0 ? 'var(--positive)' : undefined, fontWeight: d.closed > 0 ? 600 : 400 }}>
                            {d.closed}
                          </td>
                          <td style={{ textAlign: 'right', color: d.cash > 0 ? 'var(--positive)' : 'var(--ink-faint)', fontWeight: d.cash > 0 ? 600 : 400 }}>
                            {fmtCurrency(d.cash || null)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>

              <Panel>
                <PanelHeader title="Pipeline Funnel" />
                <div className="p-5 flex flex-col gap-4">
                  {funnelStages.map(stage => {
                    const pct = total > 0 ? (stage.value / total) * 100 : 0
                    return (
                      <div key={stage.label}>
                        <div className="mb-1.5 flex justify-between">
                          <span className="text-sm text-ink-muted">{stage.label}</span>
                          <span className="tnum text-sm font-semibold text-ink">{stage.value}</span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-line-strong">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: stage.color }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Panel>
            </div>

            {recentClosed.length > 0 && (
              <div className="animate-fade-up delay-3">
                <Panel>
                  <PanelHeader title="Recent Closed Deals" />
                  <table className="table-glass">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Lead</th>
                        <th>Date</th>
                        <th style={{ textAlign: 'right' }}>Contract</th>
                        <th style={{ textAlign: 'right' }}>Cash</th>
                        <th>Closer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentClosed.map(r => (
                        <tr key={r.id}>
                          <td className="font-medium">{r.company_name ?? '—'}</td>
                          <td className="text-ink-muted">{r.lead_name ?? '—'}</td>
                          <td className="text-ink-muted">{fmtDate(r.appointment_date)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--positive)', fontWeight: 600 }}>{fmtCurrency(r.contract_value)}</td>
                          <td style={{ textAlign: 'right', color: r.cash_collected ? 'var(--positive)' : 'var(--ink-faint)' }}>{fmtCurrency(r.cash_collected)}</td>
                          <td className="text-ink-muted">{r.closer ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              </div>
            )}
          </>
        )}
      </PageBody>
    </>
  )
}
