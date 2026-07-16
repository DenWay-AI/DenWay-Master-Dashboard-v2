'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import DateRangePicker from '@/components/DateRangePicker'
import LoadingState from '@/components/ui/LoadingState'
import { Modal, ModalHeader, ModalBody, ModalCloseButton } from '@/components/ui/Modal'
import {
  fmtCurrency, fmtCurrencyDec, fmtInt, fmtPct, fmtRateInt,
} from '@/lib/formatters'

// ── Types ────────────────────────────────────────────────────────────────────

interface AdMetrics {
  spend: number; impressions: number; reach: number; clicks: number
  ctr: number | null; cpm: number | null
  leads: number; cpl: number | null
  booked: number; leadToBookRate: number | null; costPerBooking: number | null
  shows: number; showRate: number | null
  qualified: number; costPerQualified: number | null
  closed: number; closeRate: number | null
  cashCollected: number; contractRevenue: number; roas: number | null
  avgLeadQuality: number | null
  outcomeClosed: number; outcomeFollowUp: number; outcomeNoSale: number; outcomeUnqualified: number
}

interface AdRow extends AdMetrics {
  adId: string | null; adName: string
  adsetName: string; campaignName: string
  isActive: boolean; status: string | null; effectiveStatus: string | null
}

interface AdsetRow extends AdMetrics {
  adsetName: string; adsetId: string | null
  isActive: boolean; ads: AdRow[]
}

interface CampaignRow extends AdMetrics {
  campaignName: string; campaignId: string | null
  isActive: boolean; adsets: AdsetRow[]
}

interface BreakdownData {
  campaigns: CampaignRow[]
  totals: AdMetrics
  lastSynced: string | null
}

type ViewBy = 'ad' | 'adset' | 'campaign'
type SortDir = 'asc' | 'desc'

interface FlatRow extends AdMetrics {
  primaryName: string
  campaignName: string
  adsetName: string | null
  adId?: string | null
  status?: string | null
  effectiveStatus?: string | null
  isActive: boolean
  adRef?: AdRow
  key: string
}

interface SelectedAd {
  adName: string; adsetName: string; campaignName: string
  adId: string | null; isActive: boolean; status: string | null
  metrics: AdMetrics
}

interface ContactRecord {
  id: string; full_name: string | null; company_name: string | null
  email: string | null; date_added: string | null
  pipeline_stage: string | null; opportunity_status: string | null
  opportunity_monetary_value: number | null
}

interface SalesRecord {
  id: string; lead_name: string | null; company_name: string | null
  date_booked: string | null; appointment_date: string | null
  show_status: string | null; qualified: string | null
  call_outcome: string | null; cash_collected: number | null
  contract_value: number | null; lead_quality_score: number | null; closer: string | null
}

// ── Column definitions (for the sortable table) ──────────────────────────────

interface ColDef {
  key: keyof AdMetrics
  label: string
  fmt: (v: any) => string
  emphasizeIfNonZero?: boolean       // bold value when > 0 (e.g. Closes, Cash)
  color?: 'positive-if-gt-1' | 'positive-if-nonzero' | 'muted'
}

const COLS: ColDef[] = [
  { key: 'spend',          label: 'Spend',   fmt: fmtCurrency },
  { key: 'cpm',            label: 'CPM',     fmt: (v) => v != null ? `$${(v as number).toFixed(1)}` : '—', color: 'muted' },
  { key: 'ctr',            label: 'CTR',     fmt: fmtPct, color: 'muted' },
  { key: 'leads',          label: 'Leads',   fmt: fmtInt },
  { key: 'cpl',            label: 'CPL',     fmt: fmtCurrencyDec },
  { key: 'booked',         label: 'Booked',  fmt: fmtInt },
  { key: 'costPerBooking', label: '$/Book',  fmt: fmtCurrencyDec },
  { key: 'shows',          label: 'Shows',   fmt: fmtInt },
  { key: 'showRate',       label: 'Show%',   fmt: (v) => v != null ? fmtRateInt(v) : '—' },
  { key: 'closed',         label: 'Closes',  fmt: fmtInt, emphasizeIfNonZero: true },
  { key: 'closeRate',      label: 'Close%',  fmt: (v) => v != null ? fmtRateInt(v) : '—' },
  { key: 'cashCollected',  label: 'Cash',    fmt: fmtCurrency, emphasizeIfNonZero: true, color: 'positive-if-nonzero' },
  { key: 'contractRevenue',label: 'Revenue', fmt: fmtCurrency, color: 'positive-if-nonzero' },
  { key: 'roas',           label: 'ROAS',    fmt: (v) => v != null ? `${(v as number).toFixed(2)}×` : '—', color: 'positive-if-gt-1' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateShort(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function fmtSynced(iso: string | null): string {
  if (!iso) return 'Never synced'
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1)  return 'Just synced'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function datePresets() {
  const today = new Date()
  const iso   = (d: Date) => d.toISOString().split('T')[0]
  const sub   = (days: number) => { const d = new Date(today); d.setDate(d.getDate() - days); return iso(d) }
  return [
    { label: '7d',    from: sub(6),                                                            to: iso(today) },
    { label: '14d',   from: sub(13),                                                           to: iso(today) },
    { label: '30d',   from: sub(29),                                                           to: iso(today) },
    { label: 'Mo',    from: iso(new Date(today.getFullYear(), today.getMonth(), 1)),           to: iso(today) },
    { label: 'All',   from: '2020-01-01',                                                      to: iso(today) },
  ]
}

function metricColor(col: ColDef, value: any): string | undefined {
  if (col.color === 'positive-if-gt-1') {
    if (value == null) return undefined
    return (value as number) >= 1 ? 'var(--positive)' : 'var(--negative)'
  }
  if (col.color === 'positive-if-nonzero') {
    return (value as number) > 0 ? 'var(--positive)' : undefined
  }
  if (col.color === 'muted') return 'var(--ink-muted)'
  return undefined
}

// ── KPI grid ─────────────────────────────────────────────────────────────────

function KpiGrid({ t }: { t: AdMetrics }) {
  const items: { label: string; value: string; sub?: string }[] = [
    { label: 'Ad Spend',       value: fmtCurrency(t.spend) },
    { label: 'Leads',          value: fmtInt(t.leads),        sub: `CPL ${fmtCurrencyDec(t.cpl)}` },
    { label: 'Booked Calls',   value: fmtInt(t.booked),       sub: `${fmtCurrencyDec(t.costPerBooking)} per booking` },
    { label: 'Shows',          value: fmtInt(t.shows),        sub: t.showRate != null ? `${fmtRateInt(t.showRate)} show rate` : undefined },
    { label: 'Closes',         value: fmtInt(t.closed),       sub: t.closeRate != null ? `${fmtRateInt(t.closeRate)} close rate` : undefined },
    { label: 'Cash Collected', value: fmtCurrency(t.cashCollected), sub: t.roas != null ? `ROAS ${t.roas.toFixed(2)}×` : undefined },
  ]
  return (
    <div className="kpi-grid">
      {items.map(it => (
        <div key={it.label} className="glass-card glass-card-lift" style={{ padding: '20px 20px' }}>
          <span className="kpi-label">{it.label}</span>
          <div className="kpi-value" style={{ marginTop: 12 }}>{it.value}</div>
          {it.sub && (
            <span style={{
              display: 'block', marginTop: 6,
              fontSize: '0.6875rem', color: 'var(--ink-muted)',
              letterSpacing: '0.04em',
            }}>{it.sub}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Ad detail modal ──────────────────────────────────────────────────────────

const SHOW_COLORS: Record<string, string> = {
  Showed: '#22c55e', 'No Show': '#ef4444', Cancelled: 'var(--ink-faint)',
  Reschedule: '#f59e0b', Pending: '#60a5fa',
}
const OUTCOME_COLORS: Record<string, string> = {
  Closed: '#22c55e', 'Follow-up': '#60a5fa', 'No Sale': 'var(--ink-faint)', Unqualified: 'var(--ink-faint)',
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: '0.6875rem', fontWeight: 600, color, letterSpacing: '0.02em',
      border: `1px solid ${color}`, background: 'transparent',
      borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

interface AdDetailModalProps {
  ad: SelectedAd
  dateFrom: string; dateTo: string
  onClose: () => void
  onAnyDeleted: () => void
}

function AdDetailModal({ ad, dateFrom, dateTo, onClose, onAnyDeleted }: AdDetailModalProps) {
  const [contacts, setContacts] = useState<ContactRecord[]>([])
  const [sales, setSales]       = useState<SalesRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams({ adName: ad.adName, from: dateFrom, to: dateTo })
    fetch(`/api/b2b-ads/ad-leads?${p}`)
      .then(r => r.json())
      .then(d => { setContacts(d.contacts ?? []); setSales(d.sales ?? []) })
      .finally(() => setLoading(false))
  }, [ad.adName, dateFrom, dateTo])

  async function deleteContact(id: string) {
    setDeleting(id)
    const res = await fetch(`/api/b2b-ads/contacts/${id}`, { method: 'DELETE' })
    if (res.ok) { setContacts(prev => prev.filter(c => c.id !== id)); onAnyDeleted() }
    setDeleting(null); setConfirmId(null)
  }
  async function deleteSale(id: string) {
    setDeleting(id)
    const res = await fetch(`/api/b2b-ads/sales/${id}`, { method: 'DELETE' })
    if (res.ok) { setSales(prev => prev.filter(s => s.id !== id)); onAnyDeleted() }
    setDeleting(null); setConfirmId(null)
  }

  function DeleteBtn({ id, onConfirm }: { id: string; onConfirm: () => void }) {
    const isConfirming = confirmId === id
    const isDeleting   = deleting === id
    return (
      <button
        onClick={e => { e.stopPropagation(); isConfirming ? onConfirm() : setConfirmId(id) }}
        onBlur={() => { if (confirmId === id) setConfirmId(null) }}
        disabled={isDeleting}
        style={{
          fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4,
          border: `1px solid ${isConfirming ? '#ef4444' : 'rgba(255,255,255,0.12)'}`,
          background: isConfirming ? 'rgba(239,68,68,0.12)' : 'transparent',
          color: isConfirming ? '#ef4444' : 'var(--ink-faint)',
          cursor: isDeleting ? 'default' : 'pointer',
          transition: 'all 120ms', whiteSpace: 'nowrap', opacity: isDeleting ? 0.4 : 1,
        }}
      >
        {isDeleting ? '…' : isConfirming ? 'Sure?' : '×'}
      </button>
    )
  }

  const m = ad.metrics
  const dotColor = ad.isActive ? 'var(--positive)' : 'rgba(255,255,255,0.3)'

  return (
    <Modal onClose={onClose} maxWidth={960}>
      <ModalHeader>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'var(--ink-faint)', marginBottom: 4 }}>
              {ad.campaignName} · {ad.adsetName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ad.adName}
              </span>
            </div>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>

        {/* Metric strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginTop: 14,
          background: 'var(--surface-2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)',
        }}>
          {[
            { label: 'Spend',   value: fmtCurrency(m.spend) },
            { label: 'Leads',   value: `${fmtInt(m.leads)} · CPL ${fmtCurrencyDec(m.cpl)}` },
            { label: 'Booked',  value: `${fmtInt(m.booked)} · ${fmtCurrencyDec(m.costPerBooking)}/bk` },
            { label: 'Shows',   value: `${fmtInt(m.shows)} · ${m.showRate != null ? fmtRateInt(m.showRate) : '—'}` },
            { label: 'Closes',  value: `${fmtInt(m.closed)} · ${m.closeRate != null ? fmtRateInt(m.closeRate) : '—'}` },
            { label: 'ROAS',    value: m.roas != null ? `${m.roas.toFixed(2)}×` : '—' },
          ].map((k, i, arr) => (
            <div key={k.label} style={{ padding: '10px 12px', borderRight: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-faint)', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
            </div>
          ))}
        </div>
      </ModalHeader>

      <ModalBody>
        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: '0.8rem' }}>Loading leads…</div>
        ) : (
          <>
            {/* Leads from GHL */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span className="section-title" style={{ fontSize: '0.9375rem' }}>Leads</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>{contacts.length} attributed via GHL UTM</span>
              </div>
              {contacts.length === 0 ? (
                <div className="glass-card" style={{ padding: 20, textAlign: 'center', fontSize: '0.8rem', color: 'var(--ink-faint)' }}>
                  No contacts found for this ad in the selected period
                </div>
              ) : (
                <div className="glass-card" style={{ overflow: 'auto' }}>
                  <table className="table-glass">
                    <thead>
                      <tr>
                        <th>Name</th><th>Company</th><th>Date Added</th><th>Pipeline Stage</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 500 }}>{c.full_name || '—'}</td>
                          <td style={{ color: 'var(--ink-muted)' }}>{c.company_name || '—'}</td>
                          <td style={{ color: 'var(--ink-faint)' }}>{fmtDateShort(c.date_added)}</td>
                          <td style={{ color: 'var(--ink-muted)' }}>{c.pipeline_stage || '—'}</td>
                          <td style={{ textAlign: 'right' }}><DeleteBtn id={c.id} onConfirm={() => deleteContact(c.id)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sales calls */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span className="section-title" style={{ fontSize: '0.9375rem' }}>Booked Calls</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>{sales.length} attributed via GHL UTM</span>
              </div>
              {sales.length === 0 ? (
                <div className="glass-card" style={{ padding: 20, textAlign: 'center', fontSize: '0.8rem', color: 'var(--ink-faint)' }}>
                  No calls found for this ad in the selected period
                </div>
              ) : (
                <div className="glass-card" style={{ overflow: 'auto' }}>
                  <table className="table-glass">
                    <thead>
                      <tr>
                        <th>Name</th><th>Company</th><th>Booked</th><th>Show</th><th>Quality</th><th>Outcome</th><th>Cash</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 500 }}>{s.lead_name || '—'}</td>
                          <td style={{ color: 'var(--ink-muted)' }}>{s.company_name || '—'}</td>
                          <td style={{ color: 'var(--ink-faint)' }}>{fmtDateShort(s.date_booked)}</td>
                          <td>{s.show_status ? <Pill label={s.show_status} color={SHOW_COLORS[s.show_status] ?? 'var(--ink-muted)'} /> : <span style={{ color: 'var(--ink-faint)' }}>—</span>}</td>
                          <td style={{ color: s.lead_quality_score != null ? '#fbbf24' : 'var(--ink-faint)' }}>
                            {s.lead_quality_score != null ? `★ ${s.lead_quality_score}` : '—'}
                          </td>
                          <td>{s.call_outcome ? <Pill label={s.call_outcome} color={OUTCOME_COLORS[s.call_outcome] ?? 'var(--ink-muted)'} /> : <span style={{ color: 'var(--ink-faint)' }}>—</span>}</td>
                          <td style={{ color: s.cash_collected ? 'var(--positive)' : 'var(--ink-faint)' }}>
                            {s.cash_collected ? fmtCurrency(s.cash_collected) : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}><DeleteBtn id={s.id} onConfirm={() => deleteSale(s.id)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </ModalBody>
    </Modal>
  )
}

// ── Sortable table ───────────────────────────────────────────────────────────

interface AdsTableProps {
  rows: FlatRow[]
  viewBy: ViewBy
  sortKey: keyof AdMetrics
  sortDir: SortDir
  onSort: (key: keyof AdMetrics) => void
  onRowClick: (ad: SelectedAd) => void
  dim?: boolean
}

function AdsTable({ rows, viewBy, sortKey, sortDir, onSort, onRowClick, dim = false }: AdsTableProps) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-faint)', fontSize: '0.875rem' }}>
        No data in this range.
      </div>
    )
  }

  const primaryLabel = viewBy === 'ad' ? 'Ad' : viewBy === 'adset' ? 'Ad Set' : 'Campaign'

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table-glass">
        <thead>
          <tr>
            <th>{primaryLabel}</th>
            {viewBy === 'ad' && <th>Status</th>}
            {COLS.map(c => {
              const isActive = c.key === sortKey
              const arrow = isActive ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''
              return (
                <th
                  key={c.key}
                  onClick={() => onSort(c.key)}
                  style={{
                    textAlign: 'right', cursor: 'pointer', userSelect: 'none',
                    color: isActive ? 'var(--ink)' : undefined,
                  }}
                >
                  {c.label}{arrow}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const clickable = viewBy === 'ad' && r.adRef
            const handleClick = clickable ? () => onRowClick({
              adName: r.adRef!.adName, adsetName: r.adRef!.adsetName, campaignName: r.adRef!.campaignName,
              adId: r.adRef!.adId, isActive: r.adRef!.isActive, status: r.adRef!.status,
              metrics: {
                spend: r.adRef!.spend, impressions: r.adRef!.impressions, reach: r.adRef!.reach, clicks: r.adRef!.clicks,
                ctr: r.adRef!.ctr, cpm: r.adRef!.cpm, leads: r.adRef!.leads, cpl: r.adRef!.cpl,
                booked: r.adRef!.booked, leadToBookRate: r.adRef!.leadToBookRate, costPerBooking: r.adRef!.costPerBooking,
                shows: r.adRef!.shows, showRate: r.adRef!.showRate, qualified: r.adRef!.qualified,
                costPerQualified: r.adRef!.costPerQualified, closed: r.adRef!.closed, closeRate: r.adRef!.closeRate,
                cashCollected: r.adRef!.cashCollected, contractRevenue: r.adRef!.contractRevenue, roas: r.adRef!.roas,
                avgLeadQuality: r.adRef!.avgLeadQuality,
                outcomeClosed: r.adRef!.outcomeClosed,
                outcomeFollowUp: r.adRef!.outcomeFollowUp,
                outcomeNoSale: r.adRef!.outcomeNoSale,
                outcomeUnqualified: r.adRef!.outcomeUnqualified,
              },
            }) : undefined

            return (
              <tr
                key={r.key}
                onClick={handleClick}
                style={{ cursor: clickable ? 'pointer' : 'default', opacity: dim ? 0.6 : 1 }}
              >
                <td>
                  <div style={{ fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.primaryName}>
                    {r.primaryName}
                  </div>
                  {viewBy === 'ad' && (
                    <div style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.campaignName} › {r.adsetName}
                    </div>
                  )}
                </td>
                {viewBy === 'ad' && (
                  <td>
                    <span className={r.isActive ? 'badge badge-success' : 'badge badge-neutral'}>
                      {r.isActive ? 'Active' : (r.status ?? 'Paused')}
                    </span>
                  </td>
                )}
                {COLS.map(c => {
                  const raw = (r as any)[c.key]
                  const isZero = raw == null || raw === 0
                  const color = isZero ? 'var(--ink-faint)' : metricColor(c, raw)
                  const weight = c.emphasizeIfNonZero && raw > 0 ? 600 : undefined
                  return (
                    <td key={c.key} style={{ textAlign: 'right', color, fontWeight: weight }}>
                      {c.fmt(raw)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function B2BAdsPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [data, setData]       = useState<BreakdownData | null>(null)
  const [loading, setLoading] = useState(true)
  const [pastOpen, setPastOpen]         = useState(false)
  const [selectedAd, setSelectedAd]     = useState<SelectedAd | null>(null)
  const [viewBy, setViewBy]   = useState<ViewBy>('ad')
  const [sortKey, setSortKey] = useState<keyof AdMetrics>('spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ from: dateFrom, to: dateTo })
    fetch(`/api/b2b-ads/breakdown?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [dateFrom, dateTo])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSort = (key: keyof AdMetrics) => {
    if (key === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const { active, past } = useMemo(() => {
    if (!data) return { active: [] as FlatRow[], past: [] as FlatRow[] }
    const all: FlatRow[] = []
    if (viewBy === 'ad') {
      for (const c of data.campaigns) for (const a of c.adsets) for (const ad of a.ads) {
        all.push({
          ...ad, primaryName: ad.adName, campaignName: c.campaignName, adsetName: a.adsetName,
          adId: ad.adId, status: ad.status, effectiveStatus: ad.effectiveStatus,
          isActive: ad.isActive, adRef: ad,
          key: `ad::${ad.adId ?? ad.adName}::${a.adsetName}::${c.campaignName}`,
        })
      }
    } else if (viewBy === 'adset') {
      for (const c of data.campaigns) for (const a of c.adsets) {
        all.push({
          ...a, primaryName: a.adsetName, campaignName: c.campaignName, adsetName: a.adsetName,
          isActive: a.isActive, key: `aset::${c.campaignName}::${a.adsetName}`,
        } as FlatRow)
      }
    } else {
      for (const c of data.campaigns) {
        all.push({
          ...c, primaryName: c.campaignName, campaignName: c.campaignName, adsetName: null,
          isActive: c.isActive, key: `camp::${c.campaignName}`,
        } as FlatRow)
      }
    }
    const cmp = (a: FlatRow, b: FlatRow) => {
      const av = (a as any)[sortKey]
      const bv = (b as any)[sortKey]
      const aNull = av == null, bNull = bv == null
      if (aNull && bNull) return 0
      if (aNull) return 1
      if (bNull) return -1
      if (av === bv) return 0
      const r = av < bv ? -1 : 1
      return sortDir === 'desc' ? -r : r
    }
    return { active: all.filter(r => r.isActive).sort(cmp), past: all.filter(r => !r.isActive).sort(cmp) }
  }, [data, viewBy, sortKey, sortDir])

  const syncedLabel = data?.lastSynced ? fmtSynced(data.lastSynced) : 'Never synced'

  return (
    <>
      <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>

        {/* Title */}
        <div className="animate-in" style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            B2B Ads Tracker
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginTop: '0.25rem' }}>
            UTM-tracked, per-ad: attribution from Meta ad → GHL contact → sales tracker outcome
          </p>
        </div>

        {/* Filter row */}
        <div className="animate-in delay-1" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
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

          <div>
            <label className="label-dark">Level</label>
            <div style={{ display: 'flex', border: '1px solid var(--line-strong)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {(['campaign', 'adset', 'ad'] as const).map(v => {
                const on = v === viewBy
                const label = v === 'ad' ? 'Ads' : v === 'adset' ? 'Ad Sets' : 'Campaigns'
                return (
                  <button key={v} onClick={() => setViewBy(v)}
                    style={{
                      padding: '0.5rem 0.875rem', fontSize: '0.8125rem', border: 'none', cursor: 'pointer',
                      background: on ? 'var(--accent-soft)' : 'transparent',
                      color: on ? 'var(--accent)' : 'var(--ink-muted)',
                      fontWeight: on ? 600 : 400,
                    }}>{label}</button>
                )
              })}
            </div>
          </div>

          <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginLeft: 'auto', marginBottom: 8 }}>
            Synced {syncedLabel}
          </span>
        </div>

        {loading ? (
          <LoadingState center />
        ) : !data ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)', fontSize: '0.875rem' }}>Failed to load</div>
        ) : (
          <>
            {/* KPI grid */}
            <div className="animate-in delay-2" style={{ marginBottom: '1.5rem' }}>
              <KpiGrid t={data.totals} />
            </div>

            {/* Active */}
            <div className="animate-in delay-3 glass-card" style={{ marginBottom: '1.5rem', padding: 0, overflow: 'hidden' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--line)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--positive)' }} />
                  <span className="section-title" style={{ fontSize: '0.9375rem' }}>
                    Active {viewBy === 'ad' ? 'Ads' : viewBy === 'adset' ? 'Ad Sets' : 'Campaigns'}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>
                  {active.length} row{active.length !== 1 ? 's' : ''}
                </span>
              </div>
              <AdsTable rows={active} viewBy={viewBy} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onRowClick={setSelectedAd} />
            </div>

            {/* Past / off */}
            {past.length > 0 && (
              <div className="animate-in delay-4 glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => setPastOpen(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.875rem 1.25rem',
                    borderBottom: pastOpen ? '1px solid var(--line)' : 'none',
                    cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                    <span className="section-title" style={{ fontSize: '0.9375rem', color: 'var(--ink-muted)' }}>
                      Past / Off {viewBy === 'ad' ? 'Ads' : viewBy === 'adset' ? 'Ad Sets' : 'Campaigns'}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent)', transition: 'transform 150ms', display: 'inline-block', transform: pastOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>
                    {past.length} row{past.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {pastOpen && (
                  <AdsTable rows={past} viewBy={viewBy} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onRowClick={setSelectedAd} dim />
                )}
              </div>
            )}

            <p className="animate-in delay-5" style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', marginTop: '1rem' }}>
              Leads, bookings, closes and cash are attributed via UTM parameters on each ad → GHL contact → sales tracker.
            </p>
          </>
        )}
      </div>

      {selectedAd && (
        <AdDetailModal
          ad={selectedAd}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onClose={() => setSelectedAd(null)}
          onAnyDeleted={fetchData}
        />
      )}
    </>
  )
}
