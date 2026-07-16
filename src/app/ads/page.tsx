'use client'

import { useState, useEffect } from 'react'
import DateRangePicker from '@/components/DateRangePicker'
import ClientSelect from '@/components/ClientSelect'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import KPICard from '@/components/ui/KPICard'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { PageHeader, PageBody } from '@/components/ui/PageHeader'
import { fmtCurrency, fmtCurrencyDec, fmtInt, fmtPct, fmtFreq } from '@/lib/formatters'

interface Totals {
  spend: number; impressions: number; reach: number; frequency: number | null
  clicks: number; ctr: number | null; cpm: number | null; cpc: number | null
  leads: number; cpl: number | null; leadCvr: number | null
}

interface Row {
  label: string; spend: number; impressions: number; reach: number; frequency: number | null
  clicks: number; ctr: number | null; cpm: number | null; cpc: number | null
  leads: number; cpl: number | null; leadCvr: number | null
}

const flatKpis = [
  { key: 'spend',       label: 'Spend',       fmt: (v: number | null) => fmtCurrency(v) },
  { key: 'cpm',         label: 'CPM',         fmt: (v: number | null) => fmtCurrencyDec(v) },
  { key: 'cpc',         label: 'CPC',         fmt: (v: number | null) => fmtCurrencyDec(v) },
  { key: 'cpl',         label: 'CPL',         fmt: (v: number | null) => fmtCurrencyDec(v) },
  { key: 'impressions', label: 'Impressions', fmt: (v: number | null) => fmtInt(v) },
  { key: 'leads',       label: 'Leads',       fmt: (v: number | null) => fmtInt(v) },
  { key: 'leadCvr',     label: 'Lead CVR',    fmt: (v: number | null) => fmtPct(v) },
]

export default function AdsPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 90)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo]     = useState(() => new Date().toISOString().split('T')[0])
  const [clientId, setClientId] = useState<string | undefined>(undefined)
  const [totals, setTotals]     = useState<Totals | null>(null)
  const [rows, setRows]         = useState<Row[]>([])
  const [loading, setLoading]   = useState(true)

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams({ from: dateFrom, to: dateTo, scope: 'b2c' })
    if (clientId) params.set('clientId', clientId)
    fetch(`/api/ads?${params}`)
      .then(r => r.json())
      .then(d => { setTotals(d.totals ?? null); setRows(d.rows ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [dateFrom, dateTo, clientId])

  const num = (t: Totals, k: string) => (t as unknown as Record<string, number | null>)[k]
  const isDateView = !!clientId

  return (
    <>
      <PageHeader
        title="B2C Ads"
        subtitle="Meta advertising performance"
        actions={
          <>
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
            {totals && (
              <div className="kpi-grid animate-fade-up mb-8">
                {flatKpis.map((item, i) => (
                  <KPICard key={item.key} label={item.label} value={item.fmt(num(totals, item.key))} delay={Math.min(i + 1, 7)} size="sm" />
                ))}
              </div>
            )}

            <div className="animate-fade-up delay-2">
              <Panel>
                <PanelHeader title="Performance" hint={isDateView ? 'daily breakdown' : 'by client'} />
                <div style={{ overflowX: 'auto' }}>
                  {rows.length === 0 ? (
                    <EmptyState title="No ad data" description="No data found for this period." />
                  ) : (
                    <table className="table-glass">
                      <thead>
                        <tr>
                          <th>{isDateView ? 'Date' : 'Client'}</th>
                          <th style={{ textAlign: 'right' }}>Spend</th>
                          <th style={{ textAlign: 'right' }}>Impressions</th>
                          <th style={{ textAlign: 'right' }}>Reach</th>
                          <th style={{ textAlign: 'right' }}>Freq</th>
                          <th style={{ textAlign: 'right' }}>Clicks</th>
                          <th style={{ textAlign: 'right' }}>CTR</th>
                          <th style={{ textAlign: 'right' }}>CPM</th>
                          <th style={{ textAlign: 'right' }}>CPC</th>
                          <th style={{ textAlign: 'right' }}>Leads</th>
                          <th style={{ textAlign: 'right' }}>CPL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(row => (
                          <tr key={row.label}>
                            <td className="font-medium">{row.label}</td>
                            <td style={{ textAlign: 'right', color: row.spend > 0 ? 'var(--ink)' : 'var(--ink-faint)' }}>{row.spend > 0 ? fmtCurrency(row.spend) : '—'}</td>
                            <td style={{ textAlign: 'right', color: row.impressions > 0 ? 'var(--ink)' : 'var(--ink-faint)' }}>{row.impressions > 0 ? fmtInt(row.impressions) : '—'}</td>
                            <td style={{ textAlign: 'right', color: row.reach > 0 ? 'var(--ink)' : 'var(--ink-faint)' }}>{row.reach > 0 ? fmtInt(row.reach) : '—'}</td>
                            <td style={{ textAlign: 'right', color: row.frequency ? 'var(--ink)' : 'var(--ink-faint)' }}>{row.frequency ? fmtFreq(row.frequency) : '—'}</td>
                            <td style={{ textAlign: 'right', color: row.clicks > 0 ? 'var(--ink)' : 'var(--ink-faint)' }}>{row.clicks > 0 ? fmtInt(row.clicks) : '—'}</td>
                            <td style={{ textAlign: 'right', color: row.ctr ? 'var(--ink)' : 'var(--ink-faint)' }}>{row.ctr ? fmtPct(row.ctr) : '—'}</td>
                            <td style={{ textAlign: 'right', color: row.cpm ? 'var(--ink)' : 'var(--ink-faint)' }}>{row.cpm ? fmtCurrencyDec(row.cpm) : '—'}</td>
                            <td style={{ textAlign: 'right', color: row.cpc ? 'var(--ink)' : 'var(--ink-faint)' }}>{row.cpc ? fmtCurrencyDec(row.cpc) : '—'}</td>
                            <td style={{ textAlign: 'right', color: row.leads > 0 ? 'var(--ink)' : 'var(--ink-faint)', fontWeight: row.leads > 0 ? 600 : 400 }}>{row.leads > 0 ? fmtInt(row.leads) : '—'}</td>
                            <td style={{ textAlign: 'right', color: row.cpl ? 'var(--ink)' : 'var(--ink-faint)' }}>{row.cpl ? fmtCurrencyDec(row.cpl) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </Panel>
            </div>
          </>
        )}
      </PageBody>
    </>
  )
}
