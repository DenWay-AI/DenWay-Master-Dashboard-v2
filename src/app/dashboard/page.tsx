'use client'

import { useState, useEffect, useCallback } from 'react'
import DateRangePicker from '@/components/DateRangePicker'
import ClientSelect from '@/components/ClientSelect'
import SyncStatusBadge from '@/components/SyncStatusBadge'
import LoadingState from '@/components/ui/LoadingState'
import { fmtCurrencyCompact, fmtRate, fmtInt, fmtDays } from '@/lib/formatters'

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Presets ──────────────────────────────────────────────────────────────────

function datePresets() {
  const today = new Date()
  const iso   = (d: Date) => d.toISOString().split('T')[0]
  const sub   = (days: number) => { const d = new Date(today); d.setDate(d.getDate() - days); return iso(d) }
  return [
    { label: '7d',   from: sub(6),                                                 to: iso(today) },
    { label: '30d',  from: sub(29),                                                to: iso(today) },
    { label: 'Mo',   from: iso(new Date(today.getFullYear(), today.getMonth(), 1)),to: iso(today) },
    { label: '90d',  from: sub(89),                                                to: iso(today) },
    { label: 'YTD',  from: iso(new Date(today.getFullYear(), 0, 1)),               to: iso(today) },
  ]
}

// ── Funnel strip (Regas pattern: 4 stages with conversion between each) ─────

interface FunnelStep {
  label: string
  value: number | null
  rate?: number | null
  rateLabel?: string
}

function FunnelStrip({ steps }: { steps: FunnelStep[] }) {
  return (
    <div className="glass-card" style={{
      padding: '1.25rem 1.5rem',
      display: 'flex', alignItems: 'stretch', gap: '0.5rem', flexWrap: 'wrap',
    }}>
      {steps.map((s, i) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '160px' }}>
          {i > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '0 0.5rem', minWidth: '76px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                {s.rate != null ? fmtRate(s.rate) : '—'}
              </span>
              <span style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ink-faint)', textAlign: 'center' }}>
                {s.rateLabel}
              </span>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <span className="kpi-label">{s.label}</span>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700,
              letterSpacing: '-0.02em', marginTop: '0.5rem', lineHeight: 1.05,
              color: 'var(--ink)', fontVariantNumeric: 'tabular-nums',
            }}>
              {s.value != null ? fmtInt(s.value) : '—'}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── KPI grid ─────────────────────────────────────────────────────────────────

interface KpiItem { label: string; value: string; sub?: string }

function KpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <div className="kpi-grid">
      {items.map(it => (
        <div key={it.label} className="glass-card glass-card-lift" style={{ padding: '20px 20px' }}>
          <span className="kpi-label">{it.label}</span>
          <div className="kpi-value" style={{ marginTop: 12 }}>{it.value}</div>
          {it.sub && (
            <span style={{ display: 'block', marginTop: 6, fontSize: '0.6875rem', color: 'var(--ink-muted)', letterSpacing: '0.04em' }}>
              {it.sub}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, sub, right }: { title: string; sub: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          {title}
        </h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '0.125rem' }}>{sub}</p>
      </div>
      {right}
    </div>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: 'var(--line)', margin: '2.5rem 0' }} />
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [clientId, setClientId] = useState<string | undefined>(undefined)
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<unknown>(null)

  const fetchData = useCallback(async () => {
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
  }, [dateFrom, dateTo, clientId])

  useEffect(() => { fetchData() }, [fetchData])

  const b2b = data?.b2b
  const b2c = data?.b2c

  const b2bFunnel: FunnelStep[] = [
    { label: 'Leads',   value: b2b?.leads   ?? null },
    { label: 'Booked',  value: b2b?.booked  ?? null, rate: b2b?.leadToBooking ?? null, rateLabel: 'booking rate' },
    { label: 'Shows',   value: b2b?.showed  ?? null, rate: b2b?.bookingToShow ?? null, rateLabel: 'show rate' },
    { label: 'Closes',  value: b2b?.closed  ?? null, rate: b2b?.showToClose   ?? null, rateLabel: 'close rate' },
  ]

  const b2cFunnel: FunnelStep[] = [
    { label: 'Leads',    value: b2c?.leads  ?? null },
    { label: 'Booked',   value: b2c?.booked ?? null, rate: b2c?.leadToBooking ?? null, rateLabel: 'booking rate' },
    { label: 'Shows',    value: b2c?.showed ?? null, rate: b2c?.bookingToShow ?? null, rateLabel: 'show rate' },
    { label: 'Closes',   value: b2c?.closed ?? null, rate: b2c?.showToClose   ?? null, rateLabel: 'close rate' },
  ]

  const b2bKpis: KpiItem[] = b2b ? [
    { label: 'Ad Spend',       value: fmtCurrencyCompact(b2b.adSpend) },
    { label: 'Cost / Lead',    value: fmtCurrencyCompact(b2b.cpl) },
    { label: 'Cost / Booking', value: fmtCurrencyCompact(b2b.cpb) },
    { label: 'CAC',            value: fmtCurrencyCompact(b2b.cac),    sub: 'cost per close' },
    { label: 'MRR',            value: fmtCurrencyCompact(b2b.mrr),    sub: 'current snapshot' },
    { label: 'LTV',            value: fmtCurrencyCompact(b2b.ltv),    sub: 'avg estimated' },
    { label: 'Pipeline',       value: fmtInt(b2b.pipeline),           sub: 'pending close' },
    { label: 'New Clients',    value: fmtInt(b2b.newClients),         sub: 'signed in period' },
    { label: 'Churn Rate',     value: fmtRate(b2b.churnRate),         sub: 'lifetime snapshot' },
    { label: 'Days to Close',  value: fmtDays(b2b.avgDaysToClose),    sub: 'avg' },
  ] : []

  const b2cKpis: KpiItem[] = b2c ? [
    { label: 'Ad Spend',       value: fmtCurrencyCompact(b2c.adSpend) },
    { label: 'Cost / Lead',    value: fmtCurrencyCompact(b2c.cpl) },
    { label: 'Cost / Booking', value: fmtCurrencyCompact(b2c.cpb) },
    { label: 'Cost / Show',    value: fmtCurrencyCompact(b2c.cps) },
    { label: 'Cost / Close',   value: fmtCurrencyCompact(b2c.cpc) },
  ] : []

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>

      {/* Title */}
      <div className="animate-in" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          Overview
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginTop: '0.25rem' }}>
          Two funnels · B2B agency sales + B2C patient acquisition
        </p>
      </div>

      {/* Filter row */}
      <div className="animate-in delay-1" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <DateRangePicker from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />

        <div>
          <label className="label-dark">Range</label>
          <div style={{ display: 'flex', border: '1px solid var(--line-strong)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {datePresets().map(p => {
              const on = p.from === dateFrom && p.to === dateTo
              return (
                <button key={p.label} onClick={() => { setDateFrom(p.from); setDateTo(p.to) }}
                  style={{
                    padding: '0.5rem 0.75rem', fontSize: '0.75rem', border: 'none', cursor: 'pointer',
                    background: on ? 'var(--accent-soft)' : 'transparent',
                    color: on ? 'var(--accent)' : 'var(--ink-muted)',
                    fontWeight: on ? 600 : 400, letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>{p.label}</button>
              )
            })}
          </div>
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <SyncStatusBadge
            syncStatus={syncStatus as Parameters<typeof SyncStatusBadge>[0]['syncStatus']}
            onSyncComplete={fetchData}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState center />
      ) : (
        <>
          {/* B2B section */}
          <section className="animate-in delay-2">
            <SectionHeader
              title="B2B — DenWay Pipeline"
              sub="Strategy sessions → signed dental practice clients"
            />
            <div style={{ marginBottom: '1rem' }}>
              <FunnelStrip steps={b2bFunnel} />
            </div>
            <KpiGrid items={b2bKpis} />
          </section>

          <Divider />

          {/* B2C section */}
          <section className="animate-in delay-3">
            <SectionHeader
              title="B2C — Client Acquisition"
              sub="Patient leads → consultations → treatment starts"
              right={<ClientSelect value={clientId} onChange={setClientId} />}
            />
            <div style={{ marginBottom: '1rem' }}>
              <FunnelStrip steps={b2cFunnel} />
            </div>
            <KpiGrid items={b2cKpis} />
          </section>
        </>
      )}
    </div>
  )
}
