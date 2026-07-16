'use client'

import { useState, useEffect } from 'react'
import DateRangePicker from '@/components/DateRangePicker'
import ClientSelect from '@/components/ClientSelect'
import SyncStatusBadge from '@/components/SyncStatusBadge'
import KPICard from '@/components/ui/KPICard'
import LoadingState from '@/components/ui/LoadingState'
import { PageHeader, PageBody } from '@/components/ui/PageHeader'
import { fmtCurrencyCompact, fmtRate, fmtInt, fmtDays } from '@/lib/formatters'

interface B2BData {
  adSpend: number | null; leads: number | null; booked: number | null
  showed: number | null; closed: number | null; cpl: number | null
  cpb: number | null; cps: number | null; cac: number | null
  mrr: number | null; leadToBooking: number | null; bookingToShow: number | null
  showToClose: number | null; churnRate: number | null; avgDaysToClose: number | null
  pipeline: number | null; newClients: number | null; ltv: number | null
}

interface B2CData {
  adSpend: number | null; leads: number | null; booked: number | null
  showed: number | null; closed: number | null; cpl: number | null
  cpb: number | null; cps: number | null; cpc: number | null
  leadToBooking: number | null; bookingToShow: number | null; showToClose: number | null
}

interface OverviewData { b2b: B2BData; b2c: B2CData }

export default function DashboardPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [clientId, setClientId] = useState<string | undefined>(undefined)
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<unknown>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo })
      if (clientId) params.set('clientId', clientId)
      const [overviewRes, syncRes] = await Promise.all([
        fetch(`/api/overview?${params}`),
        fetch('/api/sync-status'),
      ])
      const [overview, sync] = await Promise.all([overviewRes.json(), syncRes.json()])
      setData(overview)
      setSyncStatus(sync)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [dateFrom, dateTo, clientId])

  const b2b = data?.b2b
  const b2c = data?.b2c

  const b2bCards = b2b ? [
    { label: 'Ad Spend',          value: fmtCurrencyCompact(b2b.adSpend) },
    { label: 'Leads',             value: fmtInt(b2b.leads) },
    { label: 'Booked',            value: fmtInt(b2b.booked) },
    { label: 'Shows',             value: fmtInt(b2b.showed) },
    { label: 'Closed',            value: fmtInt(b2b.closed) },
    { label: 'Cost per Lead',     value: fmtCurrencyCompact(b2b.cpl) },
    { label: 'Cost per Booking',  value: fmtCurrencyCompact(b2b.cpb) },
    { label: 'Cost per Show',     value: fmtCurrencyCompact(b2b.cps) },
    { label: 'CAC',               value: fmtCurrencyCompact(b2b.cac),          sub: 'cost per close' },
    { label: 'MRR',               value: fmtCurrencyCompact(b2b.mrr),          sub: 'current snapshot' },
    { label: 'Lead → Booking',    value: fmtRate(b2b.leadToBooking) },
    { label: 'Booking → Show',    value: fmtRate(b2b.bookingToShow) },
    { label: 'Show → Close',      value: fmtRate(b2b.showToClose) },
    { label: 'Churn Rate',        value: fmtRate(b2b.churnRate),               sub: 'lifetime snapshot' },
    { label: 'Avg Days to Close', value: fmtDays(b2b.avgDaysToClose) },
    { label: 'Pipeline',          value: fmtInt(b2b.pipeline),                 sub: 'pending close' },
    { label: 'New Clients',       value: fmtInt(b2b.newClients),               sub: 'signed in period' },
    { label: 'LTV',               value: fmtCurrencyCompact(b2b.ltv),          sub: 'avg estimated' },
  ] : []

  const b2cCards = b2c ? [
    { label: 'Ad Spend',         value: fmtCurrencyCompact(b2c.adSpend) },
    { label: 'Leads',            value: fmtInt(b2c.leads) },
    { label: 'Booked',           value: fmtInt(b2c.booked) },
    { label: 'Shows',            value: fmtInt(b2c.showed) },
    { label: 'Closed',           value: fmtInt(b2c.closed),          sub: 'started treatment' },
    { label: 'Cost per Lead',    value: fmtCurrencyCompact(b2c.cpl) },
    { label: 'Cost per Booking', value: fmtCurrencyCompact(b2c.cpb) },
    { label: 'Cost per Show',    value: fmtCurrencyCompact(b2c.cps) },
    { label: 'Cost per Close',   value: fmtCurrencyCompact(b2c.cpc) },
    { label: 'Lead → Booking',   value: fmtRate(b2c.leadToBooking) },
    { label: 'Booking → Show',   value: fmtRate(b2c.bookingToShow) },
    { label: 'Show → Close',     value: fmtRate(b2c.showToClose) },
  ] : []

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="B2B pipeline + B2C client acquisition"
        actions={
          <>
            <DateRangePicker from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
            <SyncStatusBadge
              syncStatus={syncStatus as Parameters<typeof SyncStatusBadge>[0]['syncStatus']}
              onSyncComplete={fetchData}
            />
          </>
        }
      />

      <PageBody>
        {loading ? (
          <LoadingState center />
        ) : (
          <>
            {/* B2B section */}
            <div className="animate-fade-up">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-ink">B2B — DenWay Pipeline</h2>
                <p className="mt-0.5 text-xs text-ink-muted">Strategy sessions → dental practice clients</p>
              </div>
              <div className="kpi-grid">
                {b2bCards.map((card, i) => (
                  <KPICard key={card.label} label={card.label} value={card.value} sub={card.sub} delay={Math.min(i + 1, 7)} />
                ))}
              </div>
            </div>

            {/* B2C section */}
            <div className="animate-fade-up delay-3 mt-10">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-ink">B2C — Client Acquisition</h2>
                  <p className="mt-0.5 text-xs text-ink-muted">Patient leads → consultations → treatment starts</p>
                </div>
                <ClientSelect value={clientId} onChange={setClientId} />
              </div>
              <div className="kpi-grid">
                {b2cCards.map((card, i) => (
                  <KPICard key={card.label} label={card.label} value={card.value} sub={card.sub} delay={Math.min(i + 1, 7)} />
                ))}
              </div>
            </div>
          </>
        )}
      </PageBody>
    </>
  )
}
