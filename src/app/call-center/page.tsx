'use client'

import { useState, useEffect } from 'react'
import DateRangePicker from '@/components/DateRangePicker'
import ClientSelect from '@/components/ClientSelect'
import KPICard from '@/components/ui/KPICard'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { PageHeader, PageBody } from '@/components/ui/PageHeader'

interface Summary {
  totalCalls: number; inbound: number; outbound: number; inboundPct: number
  completed: number; voicemail: number; pickupRate: number; voicemailPct: number
  totalDurationSeconds: number; avgDurationSeconds: number; avgDurationFmt: string
  speedToLeadSeconds: number | null; avgAttemptsPerContact: number | null
}

interface ClientRow {
  clientId: string; clientName: string; totalCalls: number; inbound: number
  outbound: number; completed: number; voicemail: number; avgDurationFmt: string; pickupRate: number
}

interface RepRow {
  ghlUserId: string; repName: string; totalCalls: number; inbound: number
  outbound: number; avgDurationFmt: string; pickupRate: number
}

export default function CallCenterPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [clientId, setClientId] = useState<string | undefined>(undefined)
  const [data, setData] = useState<{ summary: Summary; byClient: ClientRow[]; byRep: RepRow[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)

  const syncCalls = async () => {
    setSyncing(true); setSyncMsg(null)
    try {
      const res = await fetch('/api/sync/trigger-calls', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setSyncMsg('Syncing in background…')
        let elapsed = 0
        const interval = setInterval(() => {
          elapsed += 15
          setCountdown(elapsed)
          fetchData()
          if (elapsed >= 180) {
            clearInterval(interval)
            setSyncMsg('Sync complete')
            setCountdown(null)
          }
        }, 15000)
      } else {
        setSyncMsg(`Error: ${body?.error ?? res.status}`)
      }
    } catch (e: unknown) {
      setSyncMsg(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
    setSyncing(false)
  }

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams({ from: dateFrom, to: dateTo, ...(clientId ? { clientId } : {}) })
    fetch(`/api/call-stats?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [dateFrom, dateTo, clientId])

  const s = data?.summary
  const syncCountdown = countdown ?? 0

  const syncBtn = (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={syncCalls}
        disabled={syncing || syncCountdown > 0}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {syncing ? 'Syncing…' : syncCountdown > 0 ? `Wait ${syncCountdown}s` : '↻ Sync Calls'}
      </button>
      {syncMsg && <span className="text-xs text-ink-faint">{syncMsg}</span>}
    </div>
  )

  return (
    <>
      <PageHeader
        title="Call Center"
        subtitle="GHL dialer activity"
        actions={
          <>
            <DateRangePicker from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
            <ClientSelect value={clientId} onChange={setClientId} />
            {syncBtn}
          </>
        }
      />

      <PageBody>
        {loading ? (
          <LoadingState center />
        ) : !s ? (
          <EmptyState title="No data available" description="Run the call sync script to import data from GHL." />
        ) : (
          <>
            <div className="kpi-grid animate-fade-up mb-8">
              <KPICard label="Total Calls"   value={s.totalCalls.toLocaleString()} delay={1} size="sm" />
              <KPICard label="Pickup Rate"   value={`${s.pickupRate}%`}             delay={2} size="sm" />
              <KPICard label="Avg Duration"  value={s.avgDurationFmt}               delay={3} size="sm" />
              <KPICard label="Voicemail %"   value={`${s.voicemailPct}%`}           delay={4} size="sm" />
              {s.speedToLeadSeconds != null && (
                <KPICard
                  label="Speed to Lead"
                  value={
                    s.speedToLeadSeconds < 60
                      ? `${s.speedToLeadSeconds}s`
                      : s.speedToLeadSeconds < 3600
                      ? `${Math.floor(s.speedToLeadSeconds / 60)}m ${s.speedToLeadSeconds % 60}s`
                      : `${Math.floor(s.speedToLeadSeconds / 3600)}h ${Math.floor((s.speedToLeadSeconds % 3600) / 60)}m`
                  }
                  delay={5} size="sm"
                />
              )}
              {s.avgAttemptsPerContact != null && (
                <KPICard label="Attempts/Lead" value={String(s.avgAttemptsPerContact)} delay={6} size="sm" />
              )}
            </div>

            {(data!.byClient.length > 0 || data!.byRep.length > 0) ? (
              <div className="animate-fade-up delay-2 grid grid-cols-2 gap-4">
                <Panel>
                  <PanelHeader title="By Client" />
                  {data!.byClient.length === 0 ? (
                    <EmptyState title="No client data" />
                  ) : (
                    <table className="table-glass">
                      <thead>
                        <tr>
                          <th>Client</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th style={{ textAlign: 'right' }}>In</th>
                          <th style={{ textAlign: 'right' }}>Out</th>
                          <th style={{ textAlign: 'right' }}>Avg Dur</th>
                          <th style={{ textAlign: 'right' }}>Pick-up</th>
                          <th style={{ textAlign: 'right' }}>VM%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data!.byClient.map(c => (
                          <tr key={c.clientId}>
                            <td className="font-medium">{c.clientName}</td>
                            <td style={{ textAlign: 'right' }}>{c.totalCalls}</td>
                            <td style={{ textAlign: 'right' }} className="text-ink-muted">{c.inbound}</td>
                            <td style={{ textAlign: 'right' }} className="text-ink-muted">{c.outbound}</td>
                            <td style={{ textAlign: 'right' }}>{c.avgDurationFmt}</td>
                            <td style={{ textAlign: 'right', color: c.pickupRate >= 50 ? 'var(--positive)' : 'var(--warn)' }}>{c.pickupRate}%</td>
                            <td style={{ textAlign: 'right' }} className="text-ink-muted">
                              {c.totalCalls > 0 ? `${Math.round((c.voicemail / c.totalCalls) * 100)}%` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Panel>

                <Panel>
                  <PanelHeader title="By Rep" />
                  {data!.byRep.length === 0 ? (
                    <EmptyState title="No rep data" />
                  ) : (
                    <table className="table-glass">
                      <thead>
                        <tr>
                          <th>Rep</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th style={{ textAlign: 'right' }}>In</th>
                          <th style={{ textAlign: 'right' }}>Out</th>
                          <th style={{ textAlign: 'right' }}>Avg Dur</th>
                          <th style={{ textAlign: 'right' }}>Pick-up</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data!.byRep.map(rep => (
                          <tr key={rep.ghlUserId}>
                            <td className="font-medium">{rep.repName}</td>
                            <td style={{ textAlign: 'right' }}>{rep.totalCalls}</td>
                            <td style={{ textAlign: 'right' }} className="text-ink-muted">{rep.inbound}</td>
                            <td style={{ textAlign: 'right' }} className="text-ink-muted">{rep.outbound}</td>
                            <td style={{ textAlign: 'right' }}>{rep.avgDurationFmt}</td>
                            <td style={{ textAlign: 'right', color: rep.pickupRate >= 50 ? 'var(--positive)' : 'var(--warn)' }}>{rep.pickupRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Panel>
              </div>
            ) : (
              <EmptyState title="No calls found" description="Sync calls from GHL or check your date range." />
            )}
          </>
        )}
      </PageBody>
    </>
  )
}
