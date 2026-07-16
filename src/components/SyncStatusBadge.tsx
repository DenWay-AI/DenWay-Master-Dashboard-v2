'use client'

import { useState } from 'react'
import { fmtDateLong } from '@/lib/formatters'

interface SyncStatus {
  lastSync: string | null
  status: string | null
  hasGhlData: boolean
}

interface SyncStatusBadgeProps {
  syncStatus: SyncStatus | null
  onSyncComplete?: () => void
}

export default function SyncStatusBadge({ syncStatus, onSyncComplete }: SyncStatusBadgeProps) {
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      await fetch('/api/sync/trigger', { method: 'POST' })
      setSyncMsg('Syncing…')
      setTimeout(() => {
        setSyncMsg(null)
        setSyncing(false)
        onSyncComplete?.()
      }, 8000)
    } catch {
      setSyncMsg('Failed')
      setSyncing(false)
    }
  }

  if (!syncStatus) return null

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse-soft" />
        <span className={`badge ${syncStatus.hasGhlData ? 'badge-success' : 'badge-warning'}`}>
          {syncStatus.hasGhlData ? 'GHL Synced' : 'Demo Data'}
        </span>
      </div>

      {syncStatus.lastSync && (
        <span className="text-xs text-ink-faint">
          Last sync: <span className="text-ink-muted">{fmtDateLong(syncStatus.lastSync)}</span>
        </span>
      )}

      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {syncing ? (syncMsg ?? 'Syncing…') : '↻ Sync All'}
      </button>
    </div>
  )
}
