'use client'

import { useState, useEffect } from 'react'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { PageHeader, PageBody } from '@/components/ui/PageHeader'
import { fmtDateLong } from '@/lib/formatters'

interface Client { id: string; name: string; status: string; ghl_location_id: string | null; portal_token: string | null }
interface OAuthStatus { company: { connected: boolean; valid?: boolean; expiresAt?: string }; locations: { clientId: string; connected: boolean; valid?: boolean }[] }
interface PortalUser { id: string; email: string | null; clientId: string; clientName: string | null }
interface MetaAccount { id: string; name: string; account_status: number }
interface ClientWithMeta { id: string; name: string; status: string; meta_ad_account_id: string | null }
interface LinkedRecord { id: string; company_name: string | null; call_outcome: string | null; contract_value: number | null; cash_collected: number | null; closer: string | null; appointment_date: string | null; client_id: string; clients: { name: string } | null }
interface UnlinkedRecord { id: string; company_name: string | null; lead_name: string | null; call_outcome: string | null; contract_value: number | null; cash_collected: number | null; appointment_date: string | null }
interface ClientOption { id: string; name: string; status: string }
interface VerifyResult { clientId: string; clientName: string; dbCount: number; ghlCount: number | null; delta: number | null; verifyStatus: 'ok' | 'warning' | 'mismatch' | 'no_token' | 'unknown'; lastSync: string | null }

const statusColor = (s: string) => ({ active: 'badge-success', onboarding: 'badge-info', paused: 'badge-warning', churned: 'badge-danger' }[s] ?? 'badge-neutral')

const verifyIcon = (status: VerifyResult['verifyStatus']) => {
  if (status === 'ok') return { icon: '✓', color: 'var(--positive)' }
  if (status === 'warning') return { icon: '△', color: 'var(--warn)' }
  if (status === 'mismatch') return { icon: '✕', color: 'var(--negative)' }
  return { icon: '—', color: 'var(--ink-faint)' }
}

const actionBtn = (label: string, onClick: () => void, disabled = false, primary = false) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${primary ? 'border-transparent bg-accent text-white hover:bg-accent-hover' : 'border-line-strong bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink'}`}
  >
    {label}
  </button>
)

const selectStyle: React.CSSProperties = {
  padding: '0.3rem 0.5rem', fontSize: '0.8125rem', minWidth: '220px',
  background: 'var(--surface-2)', border: '1px solid var(--line-strong)',
  borderRadius: '8px', color: 'var(--ink)', outline: 'none',
}

export default function SettingsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null)
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([])
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [verifyResults, setVerifyResults] = useState<VerifyResult[]>([])
  const [verifying, setVerifying] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [bulkReconnecting, setBulkReconnecting] = useState(false)
  const [portalEmail, setPortalEmail] = useState<Record<string, string>>({})
  const [invitingSending, setInviteSending] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [metaClients, setMetaClients] = useState<ClientWithMeta[]>([])
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([])
  const [metaSaving, setMetaSaving] = useState<string | null>(null)
  const [metaDraft, setMetaDraft] = useState<Record<string, string>>({})
  const [metaLoading, setMetaLoading] = useState(true)
  const [linkedRecords, setLinkedRecords] = useState<LinkedRecord[]>([])
  const [unlinkedRecords, setUnlinkedRecords] = useState<UnlinkedRecord[]>([])
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([])
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({})
  const [linkSaving, setLinkSaving] = useState<string | null>(null)
  const [linksLoading, setLinksLoading] = useState(true)

  const showMessage = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(null), 4000) }

  const fetchData = () => {
    Promise.all([
      fetch('/api/clients', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/oauth/ghl/status', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/settings/portal-users', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([clientData, oauthData, usersData]) => {
      setClients(Array.isArray(clientData) ? clientData : [])
      setOauthStatus(oauthData)
      setPortalUsers(Array.isArray(usersData) ? usersData : [])
    })
  }

  const fetchSalesLinks = () => {
    setLinksLoading(true)
    fetch('/api/sales-tracker?view=links', { cache: 'no-store' }).then(r => r.json()).then(d => {
      setLinkedRecords(d.linked ?? [])
      setUnlinkedRecords(d.unlinked ?? [])
      setClientOptions(d.clients ?? [])
      const draft: Record<string, string> = {};
      (d.unlinked ?? []).forEach((r: UnlinkedRecord) => { draft[r.id] = '' })
      setLinkDraft(draft)
      setLinksLoading(false)
    }).catch(() => setLinksLoading(false))
  }

  const saveSalesLink = async (recordId: string) => {
    const clientId = linkDraft[recordId]
    if (!clientId) return
    setLinkSaving(recordId)
    try {
      const res = await fetch('/api/sales-tracker', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: recordId, client_id: clientId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const record = unlinkedRecords.find(r => r.id === recordId)
      const client = clientOptions.find(c => c.id === clientId)
      if (record && client) {
        setLinkedRecords(prev => [{ id: record.id, company_name: record.company_name, call_outcome: record.call_outcome, contract_value: record.contract_value, cash_collected: record.cash_collected, closer: null, appointment_date: record.appointment_date, client_id: clientId, clients: { name: client.name } }, ...prev])
        setUnlinkedRecords(prev => prev.filter(r => r.id !== recordId))
      }
      showMessage('✓ Sales record linked to client')
    } catch (e: any) { showMessage(`Error: ${e.message}`) } finally { setLinkSaving(null) }
  }

  const fetchMetaConnections = () => {
    setMetaLoading(true)
    fetch('/api/settings/meta-connections', { cache: 'no-store' }).then(r => r.json()).then(d => {
      const mc: ClientWithMeta[] = d.clients ?? []
      setMetaClients(mc); setMetaAccounts(d.metaAccounts ?? [])
      const draft: Record<string, string> = {}; mc.forEach(c => { draft[c.id] = c.meta_ad_account_id ?? '' }); setMetaDraft(draft)
      setMetaLoading(false)
    }).catch(() => setMetaLoading(false))
  }

  const saveMetaConnection = async (clientId: string) => {
    setMetaSaving(clientId)
    try {
      const res = await fetch('/api/settings/meta-connections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, meta_ad_account_id: metaDraft[clientId] || null }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMetaClients(prev => prev.map(c => c.id === clientId ? { ...c, meta_ad_account_id: metaDraft[clientId] || null } : c))
      showMessage('✓ Meta connection updated')
    } catch (e: any) { showMessage(`Error: ${e.message}`) } finally { setMetaSaving(null) }
  }

  useEffect(() => {
    fetchMetaConnections(); fetchSalesLinks(); fetchData()
    const params = new URLSearchParams(window.location.search)
    if (params.get('oauth_success')) { showMessage('✓ GHL account connected successfully'); fetchData() }
    if (params.get('oauth_error')) showMessage(`OAuth error: ${params.get('oauth_error')}`)
    window.history.replaceState({}, '', '/settings')
  }, [])

  const connectCompany = () => { window.location.href = '/api/oauth/ghl/connect?type=company' }
  const connectClient = (clientId: string) => { window.location.href = `/api/oauth/ghl/connect?clientId=${clientId}` }

  const syncClient = async (clientId: string) => {
    setSyncing(clientId)
    try { await fetch(`/api/sync/trigger?clientId=${clientId}`, { method: 'POST' }); showMessage('Sync queued.') } finally { setSyncing(null) }
  }

  const bulkReconnect = async () => {
    setBulkReconnecting(true)
    try {
      const res = await fetch('/api/settings/bulk-reconnect', { method: 'POST' }); const data = await res.json()
      if (!res.ok) throw new Error(data.error); showMessage(`✓ ${data.message}`); fetchData()
    } catch (e: any) { showMessage(`Error: ${e.message}`) } finally { setBulkReconnecting(false) }
  }

  const verifyAll = async () => {
    setVerifying(true)
    try { const res = await fetch('/api/sync/verify'); const data = await res.json(); setVerifyResults(Array.isArray(data) ? data : []) } finally { setVerifying(false) }
  }

  const sendInvite = async (clientId: string) => {
    const email = portalEmail[clientId]; if (!email) return; setInviteSending(clientId)
    try {
      const res = await fetch('/api/settings/portal-users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, clientId }) })
      const data = await res.json(); if (!res.ok) throw new Error(data.error)
      showMessage(`✓ Invite sent to ${email}`); setPortalEmail(prev => ({ ...prev, [clientId]: '' }))
      fetch('/api/settings/portal-users').then(r => r.json()).then(d => setPortalUsers(d ?? []))
    } catch (e: any) { showMessage(`Error: ${e.message}`) } finally { setInviteSending(null) }
  }

  const getVerifyResult = (clientId: string) => verifyResults.find(r => r.clientId === clientId)
  const isClientConnected = (clientId: string) => oauthStatus?.locations.some(l => l.clientId === clientId) ?? false
  const getPortalUserForClient = (clientId: string) => portalUsers.find(u => u.clientId === clientId)

  const fmtDate = (date: string | null) => date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage GHL connections, sync, and client portal access" />

      <PageBody className="space-y-4">
        {message && (
          <div
            className="rounded-card border px-4 py-3 text-sm"
            style={{
              borderColor: message.startsWith('Error') ? 'rgba(248,113,113,0.25)' : 'rgba(93,192,138,0.25)',
              background: 'var(--surface-2)',
              color: message.startsWith('Error') ? 'var(--negative)' : 'var(--positive)',
            }}
          >
            {message}
          </div>
        )}

        {/* Section A: Agency GHL */}
        <Panel className="animate-fade-up">
          <div className="flex items-start justify-between gap-4 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">DenWay GHL Account</h2>
              <p className="mt-0.5 text-xs text-ink-faint">Company-level connection — required for creating new sub-accounts</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {oauthStatus?.company.connected ? <span className="badge badge-success">Connected</span> : <span className="badge badge-danger">Not Connected</span>}
              <button onClick={connectCompany} className="inline-flex items-center rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover" style={{ boxShadow: '0 4px 16px -6px rgba(139,92,246,0.4)' }}>
                {oauthStatus?.company.connected ? 'Reconnect' : 'Connect GHL Account'}
              </button>
            </div>
          </div>
        </Panel>

        {/* Section B: Client GHL Connections */}
        <Panel className="animate-fade-up delay-1">
          <PanelHeader
            title="Client GHL Connections"
            hint="Each client needs their own connection for data sync"
            action={
              <div className="flex gap-2">
                {actionBtn(bulkReconnecting ? 'Reconnecting…' : '↻ Bulk Reconnect', bulkReconnect, bulkReconnecting)}
                {actionBtn(verifying ? 'Verifying…' : 'Verify All', verifyAll, verifying)}
              </div>
            }
          />
          <div style={{ overflowX: 'auto' }}>
            <table className="table-glass">
              <thead>
                <tr><th>Client</th><th>Status</th><th>GHL Location ID</th><th>Connection</th><th>Verify (30d)</th><th>Last Sync</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {clients.map(client => {
                  const connected = isClientConnected(client.id)
                  const verify = getVerifyResult(client.id)
                  const vi = verify ? verifyIcon(verify.verifyStatus) : null
                  return (
                    <tr key={client.id}>
                      <td className="font-medium">{client.name}</td>
                      <td><span className={`badge ${statusColor(client.status)}`}>{client.status}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }} className="text-ink-muted">{client.ghl_location_id ?? '—'}</td>
                      <td>{connected ? <span className="badge badge-success">Connected</span> : <span className="badge badge-neutral">Not connected</span>}</td>
                      <td>
                        {vi ? (
                          <span style={{ color: vi.color, fontWeight: 600, fontSize: '0.875rem' }} title={verify ? `DB: ${verify.dbCount} · GHL: ${verify.ghlCount ?? '?'}` : ''}>
                            {vi.icon}{verify?.ghlCount != null && <span style={{ fontWeight: 400, marginLeft: '0.35rem', color: 'var(--ink-muted)' }}>{verify.dbCount}/{verify.ghlCount}</span>}
                          </span>
                        ) : <span className="text-ink-faint text-sm">—</span>}
                      </td>
                      <td className="text-ink-muted text-sm">{fmtDateLong(verify?.lastSync)}</td>
                      <td>
                        <div className="flex gap-2">
                          {actionBtn(connected ? 'Reconnect' : 'Connect', () => connectClient(client.id), false, !connected)}
                          {actionBtn(syncing === client.id ? '…' : 'Sync', () => syncClient(client.id), syncing === client.id)}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {clients.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-ink-faint text-sm">No clients found</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Section C: Client Portal Links */}
        <Panel className="animate-fade-up delay-2">
          <PanelHeader title="Client Portal Links" hint="Share these links with each practice — no login required" />
          <div style={{ overflowX: 'auto' }}>
            <table className="table-glass">
              <thead><tr><th>Client</th><th>Portal Link</th><th></th></tr></thead>
              <tbody>
                {clients.map(client => {
                  const portalUrl = client.portal_token
                    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${client.portal_token}`
                    : null
                  const isCopied = copiedToken === client.id
                  return (
                    <tr key={client.id}>
                      <td className="font-medium">{client.name}</td>
                      <td style={{ color: 'var(--ink-faint)', fontSize: '0.75rem', fontFamily: 'monospace', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {portalUrl ?? '—'}
                      </td>
                      <td>
                        {portalUrl && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(portalUrl)
                              setCopiedToken(client.id)
                              setTimeout(() => setCopiedToken(null), 2000)
                            }}
                            className="inline-flex items-center rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-3 hover:text-ink transition"
                          >
                            {isCopied ? '✓ Copied' : 'Copy link'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Section D: Meta Ad Account Connections */}
        <Panel className="animate-fade-up delay-3">
          <PanelHeader title="Meta Ad Account Connections" hint="Connect each client to their Meta ad account" action={actionBtn('↻ Refresh', fetchMetaConnections)} />
          {metaLoading ? (
            <div className="px-5 py-8 text-sm text-ink-faint">Loading…</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="table-glass">
                  <thead><tr><th>Client</th><th>Status</th><th>Connected Ad Account</th><th>Ad Account Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {metaClients.map(client => {
                      const draftAcct = metaAccounts.find(a => a.id === metaDraft[client.id])
                      const isDirty = (metaDraft[client.id] ?? '') !== (client.meta_ad_account_id ?? '')
                      return (
                        <tr key={client.id}>
                          <td className="font-medium">{client.name}</td>
                          <td><span className={`badge ${statusColor(client.status)}`}>{client.status}</span></td>
                          <td>
                            <select className="input-dark" value={metaDraft[client.id] ?? ''} onChange={e => setMetaDraft(prev => ({ ...prev, [client.id]: e.target.value }))} style={selectStyle}>
                              <option value="">— Not connected —</option>
                              {metaAccounts.map(acct => <option key={acct.id} value={acct.id}>{acct.name} ({acct.id})</option>)}
                            </select>
                          </td>
                          <td>{draftAcct ? <span className={`badge ${draftAcct.account_status === 1 ? 'badge-success' : 'badge-warning'}`}>{draftAcct.account_status === 1 ? 'Active' : 'Inactive'}</span> : <span className="text-ink-faint text-sm">—</span>}</td>
                          <td>
                            <button
                              onClick={() => saveMetaConnection(client.id)}
                              disabled={!isDirty || metaSaving === client.id}
                              className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${isDirty ? 'bg-accent text-white hover:bg-accent-hover' : 'border border-line bg-transparent text-ink-faint'}`}
                            >
                              {metaSaving === client.id ? 'Saving…' : isDirty ? 'Save' : 'Saved'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {(() => {
                const connectedIds = new Set(metaClients.map(c => c.meta_ad_account_id).filter(Boolean))
                const unmatched = metaAccounts.filter(a => !connectedIds.has(a.id))
                if (!unmatched.length) return null
                return (
                  <div className="border-t border-line px-5 py-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Unmatched Meta accounts</p>
                    <div className="flex flex-wrap gap-2">
                      {unmatched.map(acct => <span key={acct.id} className={`badge ${acct.account_status === 1 ? 'badge-neutral' : 'badge-warning'}`} title={acct.id}>{acct.name}{acct.account_status !== 1 && ' (inactive)'}</span>)}
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </Panel>

        {/* Section E: Sales Pipeline Links */}
        <Panel className="animate-fade-up delay-4">
          <PanelHeader title="Sales Pipeline Links" hint="Link Booked Calls records to their corresponding client" action={actionBtn('↻ Refresh', fetchSalesLinks)} />
          {linksLoading ? (
            <div className="px-5 py-8 text-sm text-ink-faint">Loading…</div>
          ) : (
            <>
              {unlinkedRecords.length > 0 && (
                <div>
                  <div className="border-b border-line px-5 py-2.5" style={{ background: 'rgba(224,164,88,0.06)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--warn)' }}>
                      {unlinkedRecords.length} closed/valued record{unlinkedRecords.length !== 1 ? 's' : ''} not linked to a client
                    </p>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table-glass">
                      <thead><tr><th>Company</th><th>Lead Name</th><th>Date</th><th>Outcome</th><th>Contract</th><th>Link to Client</th><th></th></tr></thead>
                      <tbody>
                        {unlinkedRecords.map(r => (
                          <tr key={r.id}>
                            <td className="font-medium">{r.company_name ?? '—'}</td>
                            <td className="text-ink-muted">{r.lead_name ?? '—'}</td>
                            <td className="text-ink-muted text-sm">{fmtDate(r.appointment_date)}</td>
                            <td>{r.call_outcome ? <span className={`badge ${r.call_outcome === 'Closed' ? 'badge-success' : r.call_outcome.includes('Follow') ? 'badge-warning' : 'badge-neutral'}`}>{r.call_outcome}</span> : '—'}</td>
                            <td style={{ color: r.contract_value ? 'var(--positive)' : 'var(--ink-faint)', fontWeight: r.contract_value ? 600 : 400 }}>
                              {r.contract_value ? `$${r.contract_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                            </td>
                            <td>
                              <select className="input-dark" value={linkDraft[r.id] ?? ''} onChange={e => setLinkDraft(prev => ({ ...prev, [r.id]: e.target.value }))} style={selectStyle}>
                                <option value="">— Select client —</option>
                                {clientOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </td>
                            <td>
                              <button
                                onClick={() => saveSalesLink(r.id)}
                                disabled={!linkDraft[r.id] || linkSaving === r.id}
                                className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${linkDraft[r.id] ? 'bg-accent text-white hover:bg-accent-hover' : 'border border-line bg-transparent text-ink-faint'}`}
                              >
                                {linkSaving === r.id ? '…' : 'Link'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                {unlinkedRecords.length > 0 && (
                  <div className="border-t border-b border-line px-5 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{linkedRecords.length} linked record{linkedRecords.length !== 1 ? 's' : ''}</p>
                  </div>
                )}
                {linkedRecords.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table-glass">
                      <thead><tr><th>Company (Sales Tracker)</th><th>Linked Client</th><th>Date</th><th>Outcome</th><th>Contract</th><th>Cash Collected</th><th>Closer</th></tr></thead>
                      <tbody>
                        {linkedRecords.map(r => (
                          <tr key={r.id}>
                            <td className="font-medium">{r.company_name ?? '—'}</td>
                            <td><span className="badge badge-success">{r.clients?.name ?? '—'}</span></td>
                            <td className="text-ink-muted text-sm">{fmtDate(r.appointment_date)}</td>
                            <td>{r.call_outcome ? <span className={`badge ${r.call_outcome === 'Closed' ? 'badge-success' : r.call_outcome.includes('Follow') ? 'badge-warning' : 'badge-neutral'}`}>{r.call_outcome}</span> : '—'}</td>
                            <td style={{ color: r.contract_value ? 'var(--positive)' : 'var(--ink-faint)', fontWeight: r.contract_value ? 600 : 400 }}>
                              {r.contract_value ? `$${r.contract_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                            </td>
                            <td style={{ color: r.cash_collected ? 'var(--positive)' : 'var(--ink-faint)' }}>
                              {r.cash_collected ? `$${r.cash_collected.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                            </td>
                            <td className="text-ink-muted">{r.closer ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center text-sm text-ink-faint">No linked records yet — link records above or run a sync to auto-match by company name</div>
                )}
              </div>
            </>
          )}
        </Panel>
      </PageBody>
    </>
  )
}
