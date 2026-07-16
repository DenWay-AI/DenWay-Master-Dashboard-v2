'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageBody } from '@/components/ui/PageHeader'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import Monogram from '@/components/ui/Monogram'
import { fmtCurrency, fmtCurrencyDec, fmtRate, fmtInt } from '@/lib/formatters'

// ── Types ──────────────────────────────────────────────────────────────────────

interface DashKPIs {
  spend: number; leads: number; cpl: number; booked: number
  showed: number; showRate: number; becamePatient: number
}
interface ChartPoint { date: string; spend: number; leads: number }
interface Appt {
  id: string; contact_name: string | null; company_name: string | null
  scheduled_at: string; outcome: string | null; consultation_outcome: string | null
  treatment_value: number | null; campaign_name: string | null; ad_name: string | null
}
interface Client {
  id: string; name: string; status: string; defcon_status: string | null
  legal_business_name: string | null; owner_name: string | null; doctor_name: string | null
  owner_email: string | null; company_email: string | null; owner_phone: string | null
  personal_phone: string | null; front_desk_phone: string | null
  city: string | null; state: string | null; business_address: string | null
  zip_code: string | null; country: string | null; time_zone: string | null
  onboarding_status: string | null; priority: string | null
  service_type: string | null; launched: boolean | null; payment_plan: string | null
  pps_fee: number | null; ppp_fee: number | null; monthly_retainer_usd: number | null
  monthly_retainer_dkk: number | null; enrollment_fee: number | null
  daily_ad_spend_agreed: number | null; date_closed: string | null
  closer_name: string | null; csm_name: string | null; media_buyer_name: string | null
  website_url: string | null; facebook_url: string | null; google_drive_url: string | null
  fathom_link: string | null; offer: string | null; deal_description: string | null
  ghl_location_id: string | null; meta_ad_account_id: string | null
  contract_signed: boolean | null; paid: boolean | null; ads_setup: boolean | null
  financing_options: boolean | null
}

// ── SVG Area Chart ─────────────────────────────────────────────────────────────

function AreaChart({ data }: { data: ChartPoint[] }) {
  if (!data || data.length < 2) return (
    <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>No ad data for this period</span>
    </div>
  )

  const W = 760, H = 160, PL = 52, PR = 12, PT = 12, PB = 28
  const plotW = W - PL - PR, plotH = H - PT - PB

  const maxSpend = Math.max(...data.map(d => d.spend), 1)
  const maxLeads = Math.max(...data.map(d => d.leads), 1)

  const sx = (i: number) => PL + (i / (data.length - 1)) * plotW
  const sy = (v: number) => PT + (1 - v / maxSpend) * plotH
  const ly = (v: number) => PT + (1 - v / maxLeads) * plotH

  const spendPts = data.map((d, i) => ({ x: sx(i), y: sy(d.spend) }))
  const leadPts  = data.map((d, i) => ({ x: sx(i), y: ly(d.leads) }))

  const mkLine = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const spendLine = mkLine(spendPts)
  const leadLine  = mkLine(leadPts)
  const spendArea = `${spendLine} L${spendPts[spendPts.length-1].x.toFixed(1)},${(PT+plotH).toFixed(1)} L${PL},${(PT+plotH).toFixed(1)} Z`

  // Y-axis ticks (4 levels)
  const yTicks = [0, 0.33, 0.66, 1].map(t => ({
    y: PT + (1 - t) * plotH,
    label: t === 0 ? '0' : fmtCurrency(maxSpend * t).replace('$','').replace(',','k').slice(0, 6),
  }))

  // X-axis: show ~5 dates
  const step = Math.max(1, Math.floor(data.length / 5))
  const xTicks = data.filter((_, i) => i % step === 0 || i === data.length - 1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 180, display: 'block' }}>
      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          <text x={PL - 6} y={t.y + 4} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.3)">{t.label}</text>
        </g>
      ))}

      {/* Spend area fill */}
      <path d={spendArea} fill="rgba(139,92,246,0.12)" />

      {/* Spend line */}
      <path d={spendLine} stroke="rgba(139,92,246,0.9)" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Leads line */}
      <path d={leadLine} stroke="rgba(93,192,138,0.7)" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3,3" />

      {/* X axis labels */}
      {xTicks.map((d, i) => {
        const idx = data.indexOf(d)
        return (
          <text key={i} x={sx(idx)} y={H - 4} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.3)">
            {d.date.slice(5)}
          </text>
        )
      })}

      {/* Legend */}
      <g>
        <rect x={PL} y={2} width={8} height={3} rx={1.5} fill="rgba(139,92,246,0.9)" />
        <text x={PL + 11} y={7} fontSize={8.5} fill="rgba(255,255,255,0.45)">Spend</text>
        <line x1={PL + 55} y1={3.5} x2={PL + 63} y2={3.5} stroke="rgba(93,192,138,0.7)" strokeWidth={1.5} strokeDasharray="2,2" />
        <text x={PL + 66} y={7} fontSize={8.5} fill="rgba(255,255,255,0.45)">Leads</text>
      </g>
    </svg>
  )
}

// ── Mini donut ─────────────────────────────────────────────────────────────────

function DonutChart({ spend, leads }: { spend: number; leads: number }) {
  const total = spend || 1
  const r = 40, cx = 56, cy = 56, stroke = 14
  const circ = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 112 112" style={{ width: 112, height: 112 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth={stroke} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(139,92,246,0.9)" strokeWidth={stroke}
        strokeDasharray={`${circ} ${circ}`} strokeDashoffset={0}
        transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="rgba(255,255,255,0.9)">
        {fmtCurrency(spend).replace('$','')}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.4)">ad spend</text>
      <text x={cx} y={cy + 20} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.4)">{leads} leads</text>
    </svg>
  )
}

// ── KPI cell ───────────────────────────────────────────────────────────────────

function KPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '14px 18px', borderRight: '1px solid var(--line)' }}>
      <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'var(--ink-faint)' }}>{label}</span>
      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: color ?? 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</span>
      {sub && <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>{sub}</span>}
    </div>
  )
}

// ── Outcome badge ──────────────────────────────────────────────────────────────

const outcomeColor: Record<string, string> = {
  showed: 'badge-success', no_show: 'badge-danger', cancelled: 'badge-warning',
  rescheduled: 'badge-info',
}
function fmtDt(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

// ── Settings form helpers ──────────────────────────────────────────────────────

const STATUS_OPTIONS = ['active', 'onboarding', 'paused', 'churned']
const SERVICE_OPTIONS = ['DFY', 'DWY']
const PAYMENT_OPTIONS = ['pay_per_show', 'pay_per_patient', 'retainer', 'pif']
const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--line-strong)',
  borderRadius: '8px', color: 'var(--ink)', fontSize: '0.875rem', outline: 'none', width: '100%',
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--ink-faint)', marginBottom: '1.25rem' }}>{children}</h2>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</label>
      {children}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ClientDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [tab, setTab] = useState<'performance' | 'settings'>('performance')

  // Performance data
  const [kpis, setKpis]       = useState<DashKPIs | null>(null)
  const [chart, setChart]     = useState<ChartPoint[]>([])
  const [appts, setAppts]     = useState<Appt[]>([])
  const [dashLoading, setDashLoading] = useState(true)

  // Settings data
  const [form, setForm]         = useState<Partial<Client>>({})
  const [original, setOriginal] = useState<Partial<Client>>({})
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch(`/api/clients/${id}/dashboard`)
      .then(r => r.json())
      .then(d => { setKpis(d.kpis); setChart(d.chartData ?? []); setAppts(d.appointments ?? []); setDashLoading(false) })
      .catch(() => setDashLoading(false))
    fetch(`/api/clients/${id}`)
      .then(r => r.json())
      .then(d => { setForm(d); setOriginal(d) })
  }, [id])

  const set = (field: keyof Client, value: unknown) => setForm(prev => ({ ...prev, [field]: value }))
  const isDirty = JSON.stringify(form) !== JSON.stringify(original)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOriginal(data); setForm(data)
      setMsg({ text: 'Saved', ok: true })
    } catch (e: any) { setMsg({ text: e.message, ok: false }) }
    finally { setSaving(false); setTimeout(() => setMsg(null), 3000) }
  }

  const txt = (field: keyof Client) => (
    <input type="text" style={inputStyle} value={(form[field] as string) ?? ''} onChange={e => set(field, e.target.value || null)} />
  )
  const numInput = (field: keyof Client, prefix?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {prefix && <span style={{ color: 'var(--ink-muted)', fontSize: '0.875rem' }}>{prefix}</span>}
      <input type="number" style={{ ...inputStyle, flex: 1 }} value={(form[field] as number) ?? ''} onChange={e => set(field, e.target.value ? Number(e.target.value) : null)} />
    </div>
  )
  const sel = (field: keyof Client, options: string[]) => (
    <select style={inputStyle} value={(form[field] as string) ?? ''} onChange={e => set(field, e.target.value || null)}>
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  const chk = (field: keyof Client, label: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--ink)' }}>
      <input type="checkbox" checked={!!(form[field])} onChange={e => set(field, e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
      {label}
    </label>
  )
  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }

  const clientName = (form.name as string) || '…'
  const defconNum  = form.defcon_status ? (form.defcon_status as string).replace(/^DEFCON\s*/i, '') : null
  const defconColor = defconNum === '1' ? 'var(--negative)' : (defconNum === '2' || defconNum === '3') ? 'var(--warn)' : 'var(--ink-faint)'

  const showRateColor = kpis
    ? (kpis.showRate >= 0.7 ? 'var(--positive)' : kpis.showRate < 0.5 ? 'var(--negative)' : 'var(--warn)')
    : 'var(--ink)'

  return (
    <>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderBottom: '1px solid var(--line)', padding: '20px 32px 0' }}>
        <button onClick={() => router.push('/clients')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--ink-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 4 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-muted)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-faint)')}>
          ← Clients
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Monogram name={clientName} size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>{clientName}</h1>
              {defconNum && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', fontWeight: 600, color: defconColor, background: 'rgba(248,113,113,0.08)', border: `1px solid ${defconColor}40`, borderRadius: 8, padding: '2px 8px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: defconColor, ...(defconNum === '1' ? { animation: 'pulse-soft 1.6s ease-in-out infinite' } : {}) }} />
                  DEFCON {defconNum}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              {form.status && <span className={`badge badge-${form.status === 'active' ? 'success' : form.status === 'churned' ? 'danger' : form.status === 'paused' ? 'warning' : 'info'}`}>{form.status as string}</span>}
              {form.meta_ad_account_id && <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-muted)', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 7px' }}>Meta</span>}
            </div>
          </div>

          {tab === 'settings' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {msg && <span style={{ fontSize: '0.8125rem', color: msg.ok ? 'var(--positive)' : 'var(--negative)' }}>{msg.ok ? '✓ ' : '✕ '}{msg.text}</span>}
              <button onClick={save} disabled={!isDirty || saving}
                style={{ padding: '8px 18px', borderRadius: 10, fontSize: '0.875rem', fontWeight: 600, cursor: isDirty ? 'pointer' : 'default', background: isDirty ? 'var(--accent)' : 'var(--surface-3)', color: isDirty ? '#fff' : 'var(--ink-faint)', border: 'none', opacity: saving ? 0.6 : 1, transition: 'background 150ms' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0 }}>
          {(['performance', 'settings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '8px 18px', fontSize: '0.8125rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: 'none', borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`, color: tab === t ? 'var(--ink)' : 'var(--ink-faint)', transition: 'color 150ms', textTransform: 'capitalize', letterSpacing: '0.02em' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Performance tab ── */}
      {tab === 'performance' && (
        <PageBody>
          {dashLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-soft 1.4s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}
              </div>
            </div>
          ) : (
            <>
              {/* KPI bar */}
              <div className="animate-fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
                <KPI label="Ad Spend" value={fmtCurrency(kpis?.spend ?? 0)} />
                <KPI label="Leads" value={fmtInt(kpis?.leads ?? null)} />
                <KPI label="CPL" value={kpis?.cpl ? fmtCurrencyDec(kpis.cpl) : '—'} />
                <KPI label="Booked" value={String(kpis?.booked ?? 0)} />
                <KPI label="Showed" value={String(kpis?.showed ?? 0)} />
                <KPI label="Show Rate" value={kpis?.showRate ? fmtRate(kpis.showRate) : '—'} color={showRateColor} />
              </div>

              {/* Chart + Donut row */}
              <div className="animate-fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 16, marginBottom: 20, alignItems: 'stretch' }}>
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px 20px 8px' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'var(--ink-faint)', marginBottom: 8 }}>
                    Ad Spend &amp; Leads — Last 30 Days
                  </div>
                  <AreaChart data={chart} />
                </div>
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'var(--ink-faint)' }}>Overview</div>
                  <DonutChart spend={kpis?.spend ?? 0} leads={kpis?.leads ?? 0} />
                  <div style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', textAlign: 'center' }}>
                    {kpis?.becamePatient ? `${kpis.becamePatient} patients` : ''}
                  </div>
                </div>
              </div>

              {/* Appointments table */}
              <div className="animate-fade-up delay-2" style={{ background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-faint)' }}>Consultations</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>{appts.length} records</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead style={{ background: 'var(--surface-2)' }}>
                      <tr>
                        {['Contact', 'Company', 'Date', 'Outcome', 'Consult Result', 'Treatment Value', 'Ad'].map(h => (
                          <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'var(--ink-faint)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {appts.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: '40px 14px', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--ink-faint)' }}>No consultations in this period</td></tr>
                      ) : appts.map(a => (
                        <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '9px 14px', fontSize: '0.8125rem', color: 'var(--ink)', fontWeight: 500 }}>{a.contact_name || '—'}</td>
                          <td style={{ padding: '9px 14px', fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>{a.company_name || '—'}</td>
                          <td style={{ padding: '9px 14px', fontSize: '0.8125rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>{fmtDt(a.scheduled_at)}</td>
                          <td style={{ padding: '9px 14px' }}>
                            {a.outcome
                              ? <span className={`badge ${outcomeColor[a.outcome] ?? 'badge-neutral'}`} style={{ fontSize: '0.7rem' }}>{a.outcome.replace('_', ' ')}</span>
                              : <span style={{ color: 'var(--ink-faint)', fontSize: '0.8125rem' }}>—</span>}
                          </td>
                          <td style={{ padding: '9px 14px', fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>{a.consultation_outcome || '—'}</td>
                          <td style={{ padding: '9px 14px', fontSize: '0.8125rem', color: a.treatment_value ? 'var(--positive)' : 'var(--ink-faint)', fontVariantNumeric: 'tabular-nums', fontWeight: a.treatment_value ? 600 : 400 }}>
                            {a.treatment_value ? fmtCurrency(a.treatment_value) : '—'}
                          </td>
                          <td style={{ padding: '9px 14px', fontSize: '0.75rem', color: 'var(--ink-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.ad_name ?? undefined}>
                            {a.ad_name || a.campaign_name || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </PageBody>
      )}

      {/* ── Settings tab ── */}
      {tab === 'settings' && (
        <PageBody className="max-w-3xl space-y-4">
          <Panel className="animate-fade-up p-6">
            <SectionLabel>Identity</SectionLabel>
            <div style={grid2}>
              <Field label="Practice Name">{txt('name')}</Field>
              <Field label="Status">{sel('status', STATUS_OPTIONS)}</Field>
              <Field label="Legal Business Name">{txt('legal_business_name')}</Field>
              <Field label="Service Type">{sel('service_type', SERVICE_OPTIONS)}</Field>
              <Field label="Owner Name">{txt('owner_name')}</Field>
              <Field label="Doctor Name">{txt('doctor_name')}</Field>
              <Field label="Owner Email">{txt('owner_email')}</Field>
              <Field label="Company Email">{txt('company_email')}</Field>
              <Field label="Owner Phone">{txt('owner_phone')}</Field>
              <Field label="Front Desk Phone">{txt('front_desk_phone')}</Field>
            </div>
          </Panel>

          <Panel className="animate-fade-up delay-1 p-6">
            <SectionLabel>Location</SectionLabel>
            <div style={grid2}>
              <Field label="City">{txt('city')}</Field>
              <Field label="State">{txt('state')}</Field>
              <Field label="Business Address">{txt('business_address')}</Field>
              <Field label="Zip Code">{txt('zip_code')}</Field>
              <Field label="Country">{txt('country')}</Field>
              <Field label="Time Zone">{txt('time_zone')}</Field>
            </div>
          </Panel>

          <Panel className="animate-fade-up delay-2 p-6">
            <SectionLabel>Ops &amp; Health</SectionLabel>
            <div style={grid2}>
              <Field label="Onboarding Status">{txt('onboarding_status')}</Field>
              <Field label="Priority">{txt('priority')}</Field>
              <Field label="DEFCON Status">{txt('defcon_status')}</Field>
              <Field label="Offer">{txt('offer')}</Field>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              {chk('launched', 'Launched')}
              {chk('contract_signed', 'Contract Signed')}
              {chk('paid', 'Paid')}
              {chk('ads_setup', 'Ads Setup')}
              {chk('financing_options', 'Financing Options')}
            </div>
          </Panel>

          <Panel className="animate-fade-up delay-2 p-6">
            <SectionLabel>Financials</SectionLabel>
            <div style={grid2}>
              <Field label="Payment Plan">{sel('payment_plan', PAYMENT_OPTIONS)}</Field>
              <Field label="Daily Ad Spend Agreed">{numInput('daily_ad_spend_agreed', '$')}</Field>
              <Field label="PPS Fee">{numInput('pps_fee', '$')}</Field>
              <Field label="PPP Fee">{numInput('ppp_fee', '$')}</Field>
              <Field label="Monthly Retainer (USD)">{numInput('monthly_retainer_usd', '$')}</Field>
              <Field label="Monthly Retainer (DKK)">{numInput('monthly_retainer_dkk', 'kr')}</Field>
              <Field label="Enrollment Fee">{numInput('enrollment_fee', '$')}</Field>
              <Field label="Date Closed">
                <input type="date" style={inputStyle} value={(form.date_closed as string) ?? ''} onChange={e => set('date_closed', e.target.value || null)} />
              </Field>
            </div>
          </Panel>

          <Panel className="animate-fade-up delay-3 p-6">
            <SectionLabel>Team</SectionLabel>
            <div style={grid2}>
              <Field label="Closer">{txt('closer_name')}</Field>
              <Field label="CSM">{txt('csm_name')}</Field>
              <Field label="Media Buyer">{txt('media_buyer_name')}</Field>
            </div>
          </Panel>

          <Panel className="animate-fade-up delay-3 p-6">
            <SectionLabel>Links &amp; Integrations</SectionLabel>
            <div style={grid2}>
              <Field label="Website">{txt('website_url')}</Field>
              <Field label="Facebook">{txt('facebook_url')}</Field>
              <Field label="Google Drive">{txt('google_drive_url')}</Field>
              <Field label="Fathom">{txt('fathom_link')}</Field>
              <Field label="GHL Location ID">
                <input type="text" style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }} value={(form.ghl_location_id as string) ?? ''} onChange={e => set('ghl_location_id', e.target.value || null)} />
              </Field>
              <Field label="Meta Ad Account ID">
                <input type="text" style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }} placeholder="act_XXXXXXXXXX" value={(form.meta_ad_account_id as string) ?? ''} onChange={e => set('meta_ad_account_id', e.target.value || null)} />
              </Field>
            </div>
          </Panel>

          <Panel className="animate-fade-up delay-4 p-6">
            <SectionLabel>Notes</SectionLabel>
            <Field label="Deal Description">
              <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={(form.deal_description as string) ?? ''} onChange={e => set('deal_description', e.target.value || null)} />
            </Field>
          </Panel>
        </PageBody>
      )}
    </>
  )
}
