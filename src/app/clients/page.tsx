'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ClientModal from '@/components/ClientModal'
import InlinePicker, { PickerOption } from '@/components/ui/InlinePicker'
import LoadingState from '@/components/ui/LoadingState'
import Monogram from '@/components/ui/Monogram'
import EmptyState from '@/components/ui/EmptyState'
import { PageHeader, PageBody } from '@/components/ui/PageHeader'
import { fmtCurrency, fmtRate } from '@/lib/formatters'

interface ClientOverview {
  id: string
  name: string
  status: string
  defconStatus: string | null
  booked: number
  showed: number
  noShow: number
  showRate: number | null
  spend: number | null
  leads: number | null
  cpl: number | null
  cps: number | null
  cpp: number | null
  hasMeta: boolean
}

const statusColors: Record<string, string> = {
  active: 'badge-success',
  paused: 'badge-warning',
  churned: 'badge-danger',
  onboarding: 'badge-info',
}

const STATUS_OPTIONS: PickerOption[] = ['active', 'onboarding', 'paused', 'churned'].map(s => ({
  value: s,
  label: s,
  badgeClass: statusColors[s] || 'badge-neutral',
}))

const DEFCON_OPTIONS: PickerOption[] = [
  { value: null, label: 'Clear', color: 'var(--ink-faint)' },
  { value: '1', label: '1', color: 'var(--negative)' },
  { value: '2', label: '2', color: 'var(--warn)' },
  { value: '3', label: '3', color: 'var(--warn)' },
  { value: '4', label: '4', color: 'var(--ink-muted)' },
  { value: '5', label: '5', color: 'var(--ink-faint)' },
]

function StatusPicker({ clientId, status, onChange, onOpenChange }: {
  clientId: string; status: string; onChange: (s: string) => void; onOpenChange?: (open: boolean) => void
}) {
  const [saving, setSaving] = useState(false)
  const handleSelect = async (v: string | null) => {
    if (!v || v === status) return
    setSaving(true)
    await fetch(`/api/clients/${clientId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: v }) })
    setSaving(false)
    onChange(v)
  }
  return (
    <InlinePicker
      value={status} options={STATUS_OPTIONS} onSelect={handleSelect} onOpenChange={onOpenChange}
      trigger={() => <span className={`badge ${statusColors[status] || 'badge-neutral'}`} style={{ opacity: saving ? 0.5 : 1 }}>{status}</span>}
    />
  )
}

function DefconPicker({ clientId, value, onChange, onOpenChange }: {
  clientId: string; value: string | null; onChange: (v: string | null) => void; onOpenChange?: (open: boolean) => void
}) {
  const [saving, setSaving] = useState(false)
  const handleSelect = async (v: string | null) => {
    if (v === value) return
    setSaving(true)
    await fetch(`/api/clients/${clientId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ defcon_status: v }) })
    setSaving(false)
    onChange(v)
  }
  const num = value ? value.replace(/^DEFCON\s*/i, '') : null
  const dotColor = num === '1' ? 'var(--negative)' : (num === '2' || num === '3') ? 'var(--warn)' : num ? 'var(--ink-muted)' : 'var(--ink-faint)'
  return (
    <InlinePicker
      value={num} options={DEFCON_OPTIONS} onSelect={handleSelect} onOpenChange={onOpenChange} align="right"
      trigger={() => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 600, color: num ? dotColor : 'var(--ink-faint)', opacity: saving ? 0.5 : 1, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}>
          {num ? (
            <>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, flexShrink: 0, ...(num === '1' ? { boxShadow: '0 0 0 2px rgba(248,113,113,0.25)', animation: 'pulse-soft 1.6s ease-in-out infinite' } : {}) }} />
              D{num}
            </>
          ) : '—'}
        </span>
      )}
    />
  )
}

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<ClientOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [openPickerId, setOpenPickerId] = useState<string | null>(null)

  const fetchData = () => {
    setLoading(true)
    fetch('/api/clients/overview')
      .then(r => r.json())
      .then(d => { setClients(Array.isArray(d.clients) ? d.clients : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const updateClientStatus = (id: string, newStatus: string) =>
    setClients(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c))

  const updateClientDefcon = (id: string, defcon: string | null) =>
    setClients(prev => prev.map(c => c.id === id ? { ...c, defconStatus: defcon } : c))

  return (
    <>
      <PageHeader title="Clients" subtitle="Performance snapshot — this month" />

      <PageBody>
        {loading ? (
          <LoadingState center />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 60px 60px 70px 90px 72px 80px 90px', gap: '0.5rem', padding: '0 18px 4px', alignItems: 'center' }}>
              {['Client', 'Status', 'Booked', 'Showed', 'Show %', 'Spend', 'Leads', 'CPL', 'DEFCON'].map((h, i) => (
                <span key={h} style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--ink-faint)', textAlign: i > 1 ? 'right' : 'left' }}>{h}</span>
              ))}
            </div>
            {clients.map((client, i) => {
              const num = client.defconStatus ? client.defconStatus.replace(/^DEFCON\s*/i, '') : null
              const dotColor = num === '1' ? 'var(--negative)' : (num === '2' || num === '3') ? 'var(--warn)' : num ? 'var(--ink-muted)' : 'transparent'
              const showRateColor = client.showRate != null
                ? client.showRate >= 0.7 ? 'var(--positive)' : client.showRate < 0.5 ? 'var(--negative)' : 'var(--warn)'
                : 'var(--ink-faint)'

              return (
                <div
                  key={client.id}
                  onClick={() => router.push(`/clients/${client.id}`)}
                  className={`animate-fade-up delay-${Math.min(i + 1, 7)}`}
                  style={{
                    borderRadius: '14px',
                    background: 'var(--surface-1)',
                    border: '1px solid var(--line)',
                    padding: '12px 18px',
                    cursor: 'pointer',
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 60px 60px 70px 90px 72px 80px 90px',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 1px 0 0 rgba(255,255,255,0.02) inset, 0 4px 12px -6px rgba(0,0,0,0.5)',
                    transition: 'background 150ms ease, border-color 150ms ease',
                    position: 'relative',
                    zIndex: openPickerId?.startsWith(client.id) ? 10 : 1,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderColor = 'var(--line-strong)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-1)'; e.currentTarget.style.borderColor = 'var(--line)' }}
                >
                  {/* Name + monogram */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <Monogram name={client.name} size={28} />
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.name}
                    </span>
                    {num && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0, ...(num === '1' ? { boxShadow: '0 0 0 2px rgba(248,113,113,0.25)', animation: 'pulse-soft 1.6s ease-in-out infinite' } : {}) }} />
                    )}
                  </div>

                  {/* Status + Defcon */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                    <StatusPicker clientId={client.id} status={client.status} onChange={s => updateClientStatus(client.id, s)} onOpenChange={isOpen => setOpenPickerId(isOpen ? `${client.id}-status` : null)} />
                  </div>

                  <span style={{ textAlign: 'right', fontSize: '0.8125rem', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{client.booked}</span>
                  <span style={{ textAlign: 'right', fontSize: '0.8125rem', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{client.showed}</span>
                  <span style={{ textAlign: 'right', fontSize: '0.8125rem', color: showRateColor, fontVariantNumeric: 'tabular-nums' }}>{client.showRate != null ? fmtRate(client.showRate) : '—'}</span>
                  <span style={{ textAlign: 'right', fontSize: '0.8125rem', color: client.spend != null ? 'var(--ink)' : 'var(--ink-faint)', fontVariantNumeric: 'tabular-nums' }}>{client.spend != null ? fmtCurrency(client.spend) : '—'}</span>
                  <span style={{ textAlign: 'right', fontSize: '0.8125rem', color: client.leads != null ? 'var(--ink)' : 'var(--ink-faint)', fontVariantNumeric: 'tabular-nums' }}>{client.leads ?? '—'}</span>
                  <span style={{ textAlign: 'right', fontSize: '0.8125rem', color: client.cpl != null ? 'var(--ink)' : 'var(--ink-faint)', fontVariantNumeric: 'tabular-nums' }}>{client.cpl != null ? fmtCurrency(client.cpl) : '—'}</span>

                  <div style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <DefconPicker clientId={client.id} value={client.defconStatus} onChange={v => updateClientDefcon(client.id, v)} onOpenChange={isOpen => setOpenPickerId(isOpen ? `${client.id}-defcon` : null)} />
                  </div>
                </div>
              )
            })}

            {clients.length === 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <EmptyState title="No clients found" description="No clients are configured yet." />
              </div>
            )}
          </div>
        )}
      </PageBody>

      <ClientModal clientId={selectedClientId} onClose={() => setSelectedClientId(null)} onSave={() => fetchData()} />
    </>
  )
}
