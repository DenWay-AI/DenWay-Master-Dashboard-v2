'use client'

import { useState, useEffect, useMemo } from 'react'
import DateRangePicker from '@/components/DateRangePicker'
import LoadingState from '@/components/ui/LoadingState'
import { PageHeader, PageBody } from '@/components/ui/PageHeader'
import KPICard from '@/components/ui/KPICard'
import { Modal, ModalHeader, ModalBody, ModalCloseButton } from '@/components/ui/Modal'
import {
  fmtCurrency, fmtCurrencyDec, fmtInt, fmtPct, fmtRateInt,
} from '@/lib/formatters'

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Column definitions ────────────────────────────────────────────────────────

interface ColDef {
  key: keyof AdMetrics
  label: string
  hint: string
  fmt: (v: any) => string
  group: 'delivery' | 'leads' | 'booking' | 'show' | 'qualify' | 'revenue'
  width: number
  hideable?: boolean
}

const COLS: ColDef[] = [
  // Delivery
  { key: 'spend',           label: 'Spend',      hint: 'Total ad spend',                  fmt: fmtCurrency,     group: 'delivery', width: 86 },
  { key: 'impressions',     label: 'Impr.',       hint: 'Impressions',                     fmt: fmtInt,          group: 'delivery', width: 80,  hideable: true },
  { key: 'cpm',             label: 'CPM',         hint: 'Cost per 1 000 impressions',      fmt: fmtCurrencyDec,  group: 'delivery', width: 76,  hideable: true },
  { key: 'clicks',          label: 'Clicks',      hint: 'Link clicks',                     fmt: fmtInt,          group: 'delivery', width: 70,  hideable: true },
  { key: 'ctr',             label: 'CTR',         hint: 'Click-through rate',              fmt: fmtPct,          group: 'delivery', width: 68,  hideable: true },
  // Leads
  { key: 'leads',           label: 'Leads',       hint: 'CRM contacts attributed to ad',   fmt: fmtInt,          group: 'leads',    width: 64 },
  { key: 'cpl',             label: 'CPL',         hint: 'Cost per lead',                   fmt: fmtCurrencyDec,  group: 'leads',    width: 76 },
  // Booking
  { key: 'booked',          label: 'Booked',      hint: 'Calls booked',                    fmt: fmtInt,          group: 'booking',  width: 68 },
  { key: 'leadToBookRate',  label: 'L→B%',        hint: 'Lead to booking rate',            fmt: v => fmtRateInt(v), group: 'booking', width: 66 },
  { key: 'costPerBooking',  label: '$/Book',      hint: 'Cost per booked call',            fmt: fmtCurrencyDec,  group: 'booking',  width: 78 },
  // Show
  { key: 'shows',           label: 'Shows',       hint: 'Calls that showed up',            fmt: fmtInt,          group: 'show',     width: 62 },
  { key: 'showRate',        label: 'Show%',       hint: 'Show rate (shows / booked)',      fmt: v => fmtRateInt(v), group: 'show',   width: 68 },
  // Qualify
  { key: 'qualified',       label: 'Qual.',       hint: 'Qualified calls',                 fmt: fmtInt,          group: 'qualify',  width: 58 },
  { key: 'costPerQualified',label: '$/Qual.',     hint: 'Cost per qualified call',         fmt: fmtCurrencyDec,  group: 'qualify',  width: 78 },
  { key: 'avgLeadQuality',  label: '★ Qual',      hint: 'Avg lead quality score (rated calls)', fmt: v => v != null ? (v as number).toFixed(1) : '—', group: 'qualify', width: 68 },
  // Revenue
  { key: 'closed',          label: 'Closed',      hint: 'Deals closed',                    fmt: fmtInt,          group: 'revenue',  width: 62 },
  { key: 'outcomeFollowUp', label: 'Follow-Up',   hint: 'Follow-up outcomes',              fmt: fmtInt,          group: 'revenue',  width: 76 },
  { key: 'closeRate',       label: 'Close%',      hint: 'Close rate (closed / qualified)', fmt: v => fmtRateInt(v), group: 'revenue', width: 70 },
  { key: 'cashCollected',   label: 'Cash',        hint: 'Cash collected from closed deals',fmt: fmtCurrency,     group: 'revenue',  width: 84 },
  { key: 'contractRevenue', label: 'Revenue',     hint: 'Contract revenue from closed deals', fmt: fmtCurrency,  group: 'revenue',  width: 86 },
  { key: 'roas',            label: 'ROAS',        hint: 'Return on ad spend (revenue/spend)', fmt: v => v != null ? `${(v as number).toFixed(2)}×` : '—', group: 'revenue', width: 70 },
]

const GROUP_STYLES: Record<string, { color: string; bg: string }> = {
  delivery: { color: 'var(--ink-faint)',  bg: 'transparent' },
  leads:    { color: '#60a5fa',           bg: 'rgba(59,130,246,0.06)' },
  booking:  { color: '#34d399',           bg: 'rgba(52,211,153,0.06)' },
  show:     { color: '#86efac',           bg: 'rgba(134,239,172,0.05)' },
  qualify:  { color: '#fbbf24',           bg: 'rgba(251,191,36,0.06)' },
  revenue:  { color: '#f59e0b',           bg: 'rgba(245,158,11,0.07)' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusDot({ isActive, status }: { isActive: boolean; status: string | null }) {
  const color = isActive ? '#22c55e' : status === 'DELETED' || status === 'ARCHIVED' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.3)'
  const title = status ?? (isActive ? 'Active' : 'Paused')
  return (
    <span title={title} style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: color, flexShrink: 0, marginRight: 6,
    }} />
  )
}

function MetricCell({ value, col, dim = false }: { value: any; col: ColDef; dim?: boolean }) {
  const g = GROUP_STYLES[col.group]
  const formatted = col.fmt(value)
  const isZero = formatted === '—' || value === 0
  return (
    <td
      title={col.hint}
      style={{
        padding: '7px 10px',
        textAlign: 'right',
        fontSize: '0.78rem',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        color: isZero ? 'var(--ink-faint)' : dim ? 'var(--ink-muted)' : g.color !== 'var(--ink-faint)' ? g.color : 'var(--ink-muted)',
        background: g.bg,
        opacity: dim && !isZero ? 0.6 : 1,
        borderBottom: '1px solid rgba(255,255,255,0.035)',
      }}
    >
      {formatted}
    </td>
  )
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

// ── KPI strip ─────────────────────────────────────────────────────────────────

function KpiStrip({ t }: { t: AdMetrics }) {
  const items = [
    { label: 'Ad Spend',       value: fmtCurrency(t.spend),               group: 'delivery' },
    { label: 'Leads (CRM)',    value: fmtInt(t.leads),                    group: 'leads' },
    { label: 'Cost / Lead',    value: fmtCurrencyDec(t.cpl),              group: 'leads' },
    { label: 'Booked Calls',   value: fmtInt(t.booked),                   group: 'booking' },
    { label: 'Lead → Book',    value: t.leadToBookRate != null ? fmtRateInt(t.leadToBookRate) : '—', group: 'booking' },
    { label: 'Cost / Booking', value: fmtCurrencyDec(t.costPerBooking),   group: 'booking' },
    { label: 'Shows',          value: fmtInt(t.shows),                    group: 'show' },
    { label: 'Show Rate',      value: t.showRate != null ? fmtRateInt(t.showRate) : '—', group: 'show' },
    { label: 'Qualified',      value: fmtInt(t.qualified),                group: 'qualify' },
    { label: 'Cost / Qual.',   value: fmtCurrencyDec(t.costPerQualified), group: 'qualify' },
    { label: 'Closed',         value: fmtInt(t.closed),                   group: 'revenue' },
    { label: 'Cash Collected', value: fmtCurrency(t.cashCollected),       group: 'revenue' },
    { label: 'Revenue',        value: fmtCurrency(t.contractRevenue),     group: 'revenue' },
    { label: 'ROAS',           value: t.roas != null ? `${t.roas.toFixed(2)}×` : '—', group: 'revenue' },
  ]

  return (
    <div className="mb-6 grid grid-cols-4 gap-3 sm:grid-cols-7 lg:grid-cols-7">
      {items.map(item => {
        const g = GROUP_STYLES[item.group]
        return (
          <KPICard
            key={item.label}
            label={item.label}
            value={item.value}
            size="sm"
            valueColor={g.color !== 'var(--ink-faint)' ? g.color : undefined}
          />
        )
      })}
    </div>
  )
}

// ── Breakdown table ───────────────────────────────────────────────────────────

// ── Ad detail modal ───────────────────────────────────────────────────────────

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

function fmtDateShort(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

const SHOW_COLORS: Record<string, string> = {
  Showed: '#22c55e', 'No Show': '#ef4444', Cancelled: 'var(--ink-faint)',
  Reschedule: '#f59e0b', Pending: '#60a5fa',
}
const OUTCOME_COLORS: Record<string, string> = {
  Closed: '#22c55e', 'Follow-up': '#60a5fa', 'No Sale': 'var(--ink-faint)', Unqualified: 'var(--ink-faint)',
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 700, color, border: `1px solid ${color}`, borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap', opacity: 0.85 }}>
      {label}
    </span>
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
    if (res.ok) {
      setContacts(prev => prev.filter(c => c.id !== id))
      onAnyDeleted()
    }
    setDeleting(null)
    setConfirmId(null)
  }

  async function deleteSale(id: string) {
    setDeleting(id)
    const res = await fetch(`/api/b2b-ads/sales/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setSales(prev => prev.filter(s => s.id !== id))
      onAnyDeleted()
    }
    setDeleting(null)
    setConfirmId(null)
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
          transition: 'all 120ms', whiteSpace: 'nowrap',
          opacity: isDeleting ? 0.4 : 1,
        }}
      >
        {isDeleting ? '…' : isConfirming ? 'Sure?' : '×'}
      </button>
    )
  }

  const m = ad.metrics

  return (
    <Modal onClose={onClose} maxWidth={960}>
      <ModalHeader>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'var(--ink-faint)', marginBottom: 4 }}>
                {ad.campaignName} · {ad.adsetName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusDot isActive={ad.isActive} status={ad.status} />
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ad.adName}
                </span>
              </div>
            </div>
            <ModalCloseButton onClose={onClose} />
          </div>

          {/* Metrics strip */}
          <div style={{ display: 'flex', gap: 0, marginTop: 14, background: 'var(--surface-2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
            {[
              { label: 'Spend',       value: fmtCurrency(m.spend),                              note: 'Meta',    color: 'var(--ink)' },
              { label: 'Leads',       value: fmtInt(m.leads),                                   note: 'GHL UTM', color: '#60a5fa' },
              { label: 'CPL',         value: fmtCurrencyDec(m.cpl),                             note: 'GHL UTM', color: '#60a5fa' },
              { label: 'Booked',      value: fmtInt(m.booked),                                  note: 'GHL UTM', color: '#34d399' },
              { label: 'Shows',       value: `${fmtInt(m.shows)} · ${m.showRate != null ? fmtRateInt(m.showRate) : '—'}`, note: 'GHL UTM', color: '#86efac' },
              { label: 'Qualified',   value: fmtInt(m.qualified),                               note: 'GHL UTM', color: '#fbbf24' },
              { label: 'Closed',      value: `${fmtInt(m.closed)} · ${m.closeRate != null ? fmtRateInt(m.closeRate) : '—'}`, note: 'GHL UTM', color: '#f59e0b' },
              { label: 'Revenue',     value: fmtCurrency(m.contractRevenue),                    note: 'GHL UTM', color: '#f59e0b' },
            ].map((k, i, arr) => (
              <div key={k.label} style={{ flex: 1, padding: '9px 12px', borderRight: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.54rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-faint)' }}>{k.label}</span>
                  <span style={{ fontSize: '0.48rem', fontWeight: 600, color: k.note === 'Meta' ? 'rgba(255,255,255,0.25)' : 'rgba(96,165,250,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{k.note}</span>
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: k.color }}>{k.value}</div>
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
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#60a5fa' }}>
                    Leads · GHL UTM
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>{contacts.length} contacts attributed to this ad</span>
                </div>
                {contacts.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--ink-faint)', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--line)' }}>
                    No contacts found for this ad in the selected period
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          {['Name', 'Company', 'Date Added', 'Pipeline Stage', ''].map(h => (
                            <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: '0.575rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-faint)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {contacts.map((c, i) => (
                          <tr key={c.id} style={{ borderBottom: i < contacts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                            <td style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--ink)', fontWeight: 500 }}>{c.full_name || '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{c.company_name || '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>{fmtDateShort(c.date_added)}</td>
                            <td style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{c.pipeline_stage || '—'}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                              <DeleteBtn id={c.id} onConfirm={() => deleteContact(c.id)} />
                            </td>
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
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#34d399' }}>
                    Booked Calls · GHL UTM
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>{sales.length} calls attributed to this ad</span>
                </div>
                {sales.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--ink-faint)', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--line)' }}>
                    No calls found for this ad in the selected period
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          {['Name', 'Company', 'Booked', 'Show', 'Quality', 'Outcome', 'Cash', ''].map(h => (
                            <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: '0.575rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-faint)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sales.map((s, i) => (
                          <tr key={s.id} style={{ borderBottom: i < sales.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                            <td style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--ink)', fontWeight: 500, whiteSpace: 'nowrap' }}>{s.lead_name || '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{s.company_name || '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>{fmtDateShort(s.date_booked)}</td>
                            <td style={{ padding: '8px 12px' }}>
                              {s.show_status
                                ? <Badge label={s.show_status} color={SHOW_COLORS[s.show_status] ?? 'var(--ink-muted)'} />
                                : <span style={{ color: 'var(--ink-faint)', fontSize: '0.78rem' }}>—</span>}
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: s.lead_quality_score != null ? '#fbbf24' : 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                              {s.lead_quality_score != null ? `★ ${s.lead_quality_score}` : '—'}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {s.call_outcome
                                ? <Badge label={s.call_outcome} color={OUTCOME_COLORS[s.call_outcome] ?? 'var(--ink-muted)'} />
                                : <span style={{ color: 'var(--ink-faint)', fontSize: '0.78rem' }}>—</span>}
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: s.cash_collected ? '#22c55e' : 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                              {s.cash_collected ? fmtCurrency(s.cash_collected) : '—'}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                              <DeleteBtn id={s.id} onConfirm={() => deleteSale(s.id)} />
                            </td>
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

// ── Flat sortable table ──────────────────────────────────────────────────────

type ViewBy = 'ad' | 'adset' | 'campaign'
type SortDir = 'asc' | 'desc'

interface FlatRow extends AdMetrics {
  // discriminated by `viewBy` of the parent table
  primaryName: string
  campaignName: string
  adsetName: string | null      // null when viewBy === 'campaign'
  // ad-specific (only when viewBy === 'ad')
  adId?: string | null
  status?: string | null
  effectiveStatus?: string | null
  isActive: boolean
  // for click-through
  adRef?: AdRow
  // for stable key
  key: string
}

interface FlatTableProps {
  rows: FlatRow[]
  viewBy: ViewBy
  sortKey: keyof AdMetrics
  sortDir: SortDir
  onSort: (key: keyof AdMetrics) => void
  onAdClick: (ad: SelectedAd) => void
  dim?: boolean
  visibleCols: ColDef[]
  hideDeliveryDetail: boolean
  onToggleDelivery: () => void
}

const NAME_WIDTH = 320

function FlatTable({ rows, viewBy, sortKey, sortDir, onSort, onAdClick, dim = false, visibleCols, hideDeliveryDetail, onToggleDelivery }: FlatTableProps) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--ink-faint)', background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 12 }}>
        No data for this period
      </div>
    )
  }

  const primaryLabel = viewBy === 'ad' ? 'Ad' : viewBy === 'adset' ? 'Ad Set' : 'Campaign'

  const totalMetricWidth = visibleCols.reduce((s, c) => s + c.width, 0)
  const tableWidth = NAME_WIDTH + totalMetricWidth

  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface-1)' }}>
      <table style={{ width: tableWidth, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: NAME_WIDTH }} />
          {visibleCols.map(c => <col key={c.key} style={{ width: c.width }} />)}
        </colgroup>

        {/* Header */}
        <thead>
          {/* Group row */}
          <tr style={{ background: 'var(--surface-2)' }}>
            <th style={{
              position: 'sticky', left: 0, zIndex: 3, background: 'var(--surface-2)',
              padding: '6px 14px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.04)',
            }} />
            {(['delivery', 'leads', 'booking', 'show', 'qualify', 'revenue'] as const).map(grp => {
              const count = visibleCols.filter(c => c.group === grp).length
              if (count === 0) return null
              const g = GROUP_STYLES[grp]
              const label = { delivery: 'Delivery', leads: 'Lead Gen', booking: 'Booking', show: 'Show', qualify: 'Qualify', revenue: 'Revenue' }[grp]
              return (
                <th key={grp} colSpan={count} style={{
                  padding: '5px 10px', textAlign: 'center', fontSize: '0.54rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.14em',
                  color: g.color, background: g.bg, borderBottom: '1px solid rgba(255,255,255,0.04)',
                  borderLeft: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {label}
                    {grp === 'delivery' && (
                      <button
                        onClick={e => { e.stopPropagation(); onToggleDelivery() }}
                        style={{
                          fontSize: '0.5rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                          cursor: 'pointer', border: '1px solid currentColor', background: 'transparent',
                          color: hideDeliveryDetail ? g.color : 'rgba(255,255,255,0.3)',
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                          opacity: hideDeliveryDetail ? 1 : 0.6,
                          transition: 'opacity 150ms, color 150ms',
                        }}
                      >
                        {hideDeliveryDetail ? 'show detail' : 'hide detail'}
                      </button>
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
          {/* Column row */}
          <tr style={{ background: 'var(--surface-2)' }}>
            <th style={{
              position: 'sticky', left: 0, zIndex: 3, background: 'var(--surface-2)',
              padding: '7px 14px', textAlign: 'left', fontSize: '0.575rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.13em', color: 'var(--ink-faint)',
              borderBottom: '1px solid var(--line)',
            }}>{primaryLabel}</th>
            {visibleCols.map(c => {
              const g = GROUP_STYLES[c.group]
              const isActive = c.key === sortKey
              const arrow = isActive ? (sortDir === 'desc' ? '↓' : '↑') : ''
              return (
                <th key={c.key} title={c.hint + ' — click to sort'}
                  onClick={() => onSort(c.key)}
                  style={{
                  padding: '7px 10px', textAlign: 'right', fontSize: '0.575rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.13em',
                  color: isActive ? (g.color !== 'var(--ink-faint)' ? g.color : 'var(--ink)') : 'var(--ink-faint)',
                  background: g.bg, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap',
                  cursor: 'pointer', userSelect: 'none',
                  borderLeft: c.key === 'leads' || c.key === 'booked' || c.key === 'shows' || c.key === 'qualified' || c.key === 'closed'
                    ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  {c.label}{arrow && <span style={{ marginLeft: 4 }}>{arrow}</span>}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map(r => {
            const clickable = viewBy === 'ad' && r.adRef
            const handleClick = clickable ? () => onAdClick({
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

            // Sub-text below the primary name varies by viewBy
            const subtext = viewBy === 'ad'
              ? `${r.campaignName} · ${r.adsetName ?? ''}`
              : viewBy === 'adset'
              ? r.campaignName
              : null

            return (
              <tr
                key={r.key}
                onClick={handleClick}
                onMouseEnter={e => { if (clickable) { e.currentTarget.style.background = 'rgba(139,92,246,0.06)'; e.currentTarget.style.cursor = 'pointer' } else { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.035)' }}
              >
                <td style={{
                  position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface-1)',
                  padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.035)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                    <div style={{ paddingTop: 3 }}><StatusDot isActive={r.isActive} status={r.status ?? null} /></div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: viewBy === 'campaign' ? 700 : 600, color: dim ? 'var(--ink-muted)' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: dim ? 0.7 : 1, flex: 1 }} title={r.primaryName}>
                          {r.primaryName}
                        </span>
                        {clickable && <span style={{ fontSize: '0.6rem', color: 'var(--accent)', opacity: 0.5, flexShrink: 0 }}>↗</span>}
                      </div>
                      {subtext && (
                        <div style={{ fontSize: '0.625rem', color: 'var(--ink-faint)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={subtext}>
                          {subtext}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                {visibleCols.map(c => <MetricCell key={c.key} col={c} value={(r as any)[c.key]} dim={dim} />)}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function datePresets() {
  const today = new Date()
  const iso   = (d: Date) => d.toISOString().split('T')[0]
  const sub   = (days: number) => { const d = new Date(today); d.setDate(d.getDate() - days); return iso(d) }
  return [
    { label: '7d',    from: sub(6),     to: iso(today) },
    { label: '14d',   from: sub(13),    to: iso(today) },
    { label: '30d',   from: sub(29),    to: iso(today) },
    { label: 'Mo',    from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) },
    { label: 'All',   from: '2020-01-01', to: iso(today) },
  ]
}

export default function B2BAdsPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [data, setData]       = useState<BreakdownData | null>(null)
  const [loading, setLoading] = useState(true)
  const [pastOpen, setPastOpen]         = useState(false)
  const [hideDeliveryDetail, setHideDeliveryDetail] = useState(false)
  const [selectedAd, setSelectedAd]     = useState<SelectedAd | null>(null)
  const [viewBy, setViewBy]   = useState<ViewBy>('ad')
  const [sortKey, setSortKey] = useState<keyof AdMetrics>('spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const visibleCols = COLS.filter(c => !(hideDeliveryDetail && c.hideable))

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams({ from: dateFrom, to: dateTo })
    fetch(`/api/b2b-ads/breakdown?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [dateFrom, dateTo])

  const handleSort = (key: keyof AdMetrics) => {
    if (key === sortKey) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  // Flatten campaigns → rows based on viewBy, then split active/past, then sort.
  const { active, past } = useMemo(() => {
    if (!data) return { active: [] as FlatRow[], past: [] as FlatRow[] }

    const all: FlatRow[] = []
    if (viewBy === 'ad') {
      for (const c of data.campaigns) {
        for (const a of c.adsets) {
          for (const ad of a.ads) {
            all.push({
              ...ad,
              primaryName: ad.adName,
              campaignName: c.campaignName,
              adsetName: a.adsetName,
              adId: ad.adId, status: ad.status, effectiveStatus: ad.effectiveStatus,
              isActive: ad.isActive,
              adRef: ad,
              key: `ad::${ad.adId ?? ad.adName}::${a.adsetName}::${c.campaignName}`,
            })
          }
        }
      }
    } else if (viewBy === 'adset') {
      for (const c of data.campaigns) {
        for (const a of c.adsets) {
          all.push({
            ...a,
            primaryName: a.adsetName,
            campaignName: c.campaignName,
            adsetName: a.adsetName,
            isActive: a.isActive,
            key: `aset::${c.campaignName}::${a.adsetName}`,
          } as FlatRow)
        }
      }
    } else {
      for (const c of data.campaigns) {
        all.push({
          ...c,
          primaryName: c.campaignName,
          campaignName: c.campaignName,
          adsetName: null,
          isActive: c.isActive,
          key: `camp::${c.campaignName}`,
        } as FlatRow)
      }
    }

    const cmp = (a: FlatRow, b: FlatRow) => {
      const av = (a as any)[sortKey]
      const bv = (b as any)[sortKey]
      // Nulls go to the bottom regardless of direction
      const aNull = av == null
      const bNull = bv == null
      if (aNull && bNull) return 0
      if (aNull) return 1
      if (bNull) return -1
      if (av === bv) return 0
      const r = av < bv ? -1 : 1
      return sortDir === 'desc' ? -r : r
    }

    return {
      active: all.filter(r => r.isActive).sort(cmp),
      past:   all.filter(r => !r.isActive).sort(cmp),
    }
  }, [data, viewBy, sortKey, sortDir])

  const syncedLabel = data?.lastSynced ? fmtSynced(data.lastSynced) : 'Never synced'

  return (
    <>
      <PageHeader
        title="B2B Ads Tracker"
        subtitle="Full funnel breakdown · per ad, ad set, or campaign"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>Synced {syncedLabel}</span>
            {/* View by toggle */}
            <div style={{ display: 'flex', gap: 4 }}>
              {(['ad', 'adset', 'campaign'] as const).map(v => {
                const isOn = v === viewBy
                const label = v === 'ad' ? 'Ad' : v === 'adset' ? 'Ad Set' : 'Campaign'
                return (
                  <button
                    key={v}
                    onClick={() => setViewBy(v)}
                    style={{
                      fontSize: '0.625rem', fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                      cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase',
                      border: `1px solid ${isOn ? '#34d399' : 'var(--line)'}`,
                      background: isOn ? 'rgba(52,211,153,0.12)' : 'transparent',
                      color: isOn ? '#34d399' : 'var(--ink-faint)',
                      transition: 'all 100ms',
                    }}
                  >{label}</button>
                )
              })}
            </div>
            {/* Date presets */}
            <div style={{ display: 'flex', gap: 4 }}>
              {datePresets().map(p => {
                const active = p.from === dateFrom && p.to === dateTo
                return (
                  <button
                    key={p.label}
                    onClick={() => { setDateFrom(p.from); setDateTo(p.to) }}
                    style={{
                      fontSize: '0.625rem', fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                      cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
                      background: active ? 'rgba(139,92,246,0.15)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--ink-faint)',
                      transition: 'all 100ms',
                    }}
                  >{p.label}</button>
                )
              })}
            </div>
            <DateRangePicker from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          </div>
        }
      />

      <PageBody>
        {loading ? <LoadingState center /> : !data ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)', fontSize: '0.875rem' }}>Failed to load</div>
        ) : (
          <>
            {/* KPI strip */}
            <section className="animate-fade-up" style={{ marginBottom: 28 }}>
              <KpiStrip t={data.totals} />
            </section>

            {/* Active ads */}
            <section className="animate-fade-up delay-1" style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--ink-faint)' }}>
                    Active Ads
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>
                  {active.length} {viewBy === 'ad' ? 'ad' : viewBy === 'adset' ? 'ad set' : 'campaign'}{active.length !== 1 ? 's' : ''}
                </span>
              </div>
              <FlatTable rows={active} viewBy={viewBy} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onAdClick={setSelectedAd} visibleCols={visibleCols} hideDeliveryDetail={hideDeliveryDetail} onToggleDelivery={() => setHideDeliveryDetail(v => !v)} />
            </section>

            {/* Past / off ads */}
            {past.length > 0 && (
              <section className="animate-fade-up delay-2">
                <div
                  onClick={() => setPastOpen(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: pastOpen ? 8 : 0, cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--ink-faint)' }}>
                      Past / Off Ads
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--accent)', transition: 'transform 150ms', display: 'inline-block', transform: pastOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>
                    {past.length} {viewBy === 'ad' ? 'ad' : viewBy === 'adset' ? 'ad set' : 'campaign'}{past.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {pastOpen && (
                  <FlatTable rows={past} viewBy={viewBy} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onAdClick={setSelectedAd} dim visibleCols={visibleCols} hideDeliveryDetail={hideDeliveryDetail} onToggleDelivery={() => setHideDeliveryDetail(v => !v)} />
                )}
              </section>
            )}
          </>
        )}
      </PageBody>

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
