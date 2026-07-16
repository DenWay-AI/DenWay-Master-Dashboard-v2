'use client'

import { useState, useEffect } from 'react'
import Modal from './Modal'

interface Client {
  id: string
  name: string
  status: string
  owner_name: string | null
  doctor_name: string | null
  owner_email: string | null
  company_email: string | null
  owner_phone: string | null
  front_desk_phone: string | null
  city: string | null
  state: string | null
  business_address: string | null
  service_type: string | null
  payment_plan: string | null
  pps_fee: number | null
  ppp_fee: number | null
  monthly_retainer_usd: number | null
  daily_ad_spend_agreed: number | null
  closer_name: string | null
  csm_name: string | null
  media_buyer_name: string | null
  defcon_status: string | null
  onboarding_status: string | null
  launched: boolean | null
  contract_signed: boolean | null
  paid: boolean | null
  website_url: string | null
  ghl_location_id: string | null
}

interface ClientModalProps {
  clientId: string | null
  onClose: () => void
  onSave?: (updated: Partial<Client>) => void
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  background: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 'var(--radius)',
  color: 'hsl(var(--foreground))',
  fontSize: '0.875rem',
  outline: 'none',
  width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase' as const,
  letterSpacing: '0.04em', color: 'hsl(var(--muted-foreground))',
  marginBottom: '0.375rem', display: 'block',
}

const STATUS_OPTIONS = ['active', 'onboarding', 'paused', 'churned']
const SERVICE_OPTIONS = ['DFY', 'DWY']
const PAYMENT_OPTIONS = ['pay_per_show', 'pay_per_patient', 'retainer', 'pif']

export default function ClientModal({ clientId, onClose, onSave }: ClientModalProps) {
  const [client, setClient] = useState<Client | null>(null)
  const [form, setForm] = useState<Partial<Client>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    fetch(`/api/clients/${clientId}`)
      .then(r => r.json())
      .then(d => { setClient(d); setForm(d); setLoading(false) })
  }, [clientId])

  const set = (field: keyof Client, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const isDirty = JSON.stringify(form) !== JSON.stringify(client)

  const save = async () => {
    if (!clientId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setClient(form as Client)
      setMessage({ text: 'Saved', ok: true })
      onSave?.(data)
      setTimeout(() => setMessage(null), 2000)
    } catch (e: any) {
      setMessage({ text: e.message, ok: false })
    } finally {
      setSaving(false)
    }
  }

  const txt = (field: keyof Client) => (
    <input type="text" className="input-dark" style={inputStyle}
      value={(form[field] as string) ?? ''}
      onChange={e => set(field, e.target.value || null)} />
  )

  const num = (field: keyof Client, prefix?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {prefix && <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>{prefix}</span>}
      <input type="number" className="input-dark" style={{ ...inputStyle, flex: 1 }}
        value={(form[field] as number) ?? ''}
        onChange={e => set(field, e.target.value ? Number(e.target.value) : null)} />
    </div>
  )

  const sel = (field: keyof Client, options: string[]) => (
    <select className="input-dark" style={inputStyle}
      value={(form[field] as string) ?? ''}
      onChange={e => set(field, e.target.value || null)}>
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  const chk = (field: keyof Client, label: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'hsl(var(--foreground))' }}>
      <input type="checkbox" checked={!!form[field]} onChange={e => set(field, e.target.checked)}
        style={{ width: '16px', height: '16px', accentColor: 'hsl(var(--brand))', cursor: 'pointer' }} />
      {label}
    </label>
  )

  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }
  const section = (title: string) => (
    <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'hsl(var(--brand))', paddingBottom: '0.5rem', borderBottom: '1px solid hsl(var(--border))' }}>
      {title}
    </div>
  )

  return (
    <Modal open={!!clientId} onClose={onClose} title={loading ? 'Loading…' : (client?.name ?? 'Client')} width="680px">
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>Loading…</div>
      ) : client && (
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Identity */}
          {section('Identity')}
          <div style={grid2}>
            <div><label style={labelStyle}>Practice Name</label>{txt('name')}</div>
            <div><label style={labelStyle}>Status</label>{sel('status', STATUS_OPTIONS)}</div>
            <div><label style={labelStyle}>Owner Name</label>{txt('owner_name')}</div>
            <div><label style={labelStyle}>Doctor Name</label>{txt('doctor_name')}</div>
            <div><label style={labelStyle}>Owner Email</label>{txt('owner_email')}</div>
            <div><label style={labelStyle}>Company Email</label>{txt('company_email')}</div>
            <div><label style={labelStyle}>Owner Phone</label>{txt('owner_phone')}</div>
            <div><label style={labelStyle}>Front Desk Phone</label>{txt('front_desk_phone')}</div>
          </div>

          {/* Location */}
          {section('Location')}
          <div style={grid2}>
            <div><label style={labelStyle}>City</label>{txt('city')}</div>
            <div><label style={labelStyle}>State</label>{txt('state')}</div>
            <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Address</label>{txt('business_address')}</div>
          </div>

          {/* Ops */}
          {section('Ops & Health')}
          <div style={grid2}>
            <div><label style={labelStyle}>DEFCON Status</label>{txt('defcon_status')}</div>
            <div><label style={labelStyle}>Onboarding Status</label>{txt('onboarding_status')}</div>
            <div><label style={labelStyle}>Service Type</label>{sel('service_type', SERVICE_OPTIONS)}</div>
            <div><label style={labelStyle}>Closer</label>{txt('closer_name')}</div>
            <div><label style={labelStyle}>CSM</label>{txt('csm_name')}</div>
            <div><label style={labelStyle}>Media Buyer</label>{txt('media_buyer_name')}</div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {chk('launched', 'Launched')}
            {chk('contract_signed', 'Contract Signed')}
            {chk('paid', 'Paid')}
          </div>

          {/* Financials */}
          {section('Financials')}
          <div style={grid2}>
            <div><label style={labelStyle}>Payment Plan</label>{sel('payment_plan', PAYMENT_OPTIONS)}</div>
            <div><label style={labelStyle}>Daily Ad Spend</label>{num('daily_ad_spend_agreed', '$')}</div>
            <div><label style={labelStyle}>PPS Fee</label>{num('pps_fee', '$')}</div>
            <div><label style={labelStyle}>Monthly Retainer (USD)</label>{num('monthly_retainer_usd', '$')}</div>
          </div>

          {/* Links */}
          {section('Links')}
          <div style={grid2}>
            <div><label style={labelStyle}>Website</label>{txt('website_url')}</div>
            <div>
              <label style={labelStyle}>GHL Location ID</label>
              <input type="text" className="input-dark"
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.8125rem' }}
                value={(form.ghl_location_id as string) ?? ''}
                onChange={e => set('ghl_location_id', e.target.value || null)} />
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', paddingTop: '0.5rem', borderTop: '1px solid hsl(var(--border))' }}>
            {message && (
              <span style={{ fontSize: '0.8125rem', color: message.ok ? 'hsl(var(--positive))' : 'hsl(var(--negative))' }}>
                {message.ok ? '✓ ' : '✕ '}{message.text}
              </span>
            )}
            <button onClick={onClose}
              style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', cursor: 'pointer' }}>
              Close
            </button>
            <button onClick={save} disabled={!isDirty || saving}
              style={{ padding: '0.5rem 1.25rem', background: isDirty ? 'hsl(var(--brand))' : 'hsl(var(--border))', color: isDirty ? 'hsl(var(--brand-foreground))' : 'hsl(var(--muted-foreground))', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.875rem', fontWeight: 600, cursor: isDirty ? 'pointer' : 'default', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
