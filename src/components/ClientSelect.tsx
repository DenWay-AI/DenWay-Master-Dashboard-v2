'use client'

import { useState, useEffect } from 'react'

interface Client {
  id: string
  name: string
  status: string
}

interface ClientSelectProps {
  value: string | undefined
  onChange: (value: string | undefined) => void
}

export default function ClientSelect({ value, onChange }: ClientSelectProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => { setClients(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div>
      <label htmlFor="client-select" className="label-dark">Client</label>
      <select
        id="client-select"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || undefined)}
        className="input-dark"
        style={{ minWidth: '180px', cursor: 'pointer' }}
      >
        <option value="">All clients</option>
        {loading ? (
          <option disabled>Loading…</option>
        ) : (
          clients.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))
        )}
      </select>
    </div>
  )
}
