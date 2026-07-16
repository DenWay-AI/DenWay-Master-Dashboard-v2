// Integer currency: $1,234
export function fmtCurrency(v: number | null): string {
  if (v == null) return '—'
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// Two-decimal currency: $1.23 — for CPM, CPC, CPL
export function fmtCurrencyDec(v: number | null): string {
  if (v == null) return '—'
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Compact currency: $1.5k / $1.5M — for dashboard KPI cards
export function fmtCurrencyCompact(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}

// Rate from 0–1 decimal, 1 decimal: 0.35 → "35.1%" — show rate, close rate
export function fmtRate(v: number | null): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(1)}%`
}

// Rate from 0–1 decimal, 0 decimals: 0.35 → "35%" — inline table display
export function fmtRateInt(v: number | null): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(0)}%`
}

// Raw percentage, 2 decimals: 3.50 → "3.50%" — ads CTR, CVR
export function fmtPct(v: number | null): string {
  if (v == null) return '—'
  return `${v.toFixed(2)}%`
}

// Locale-formatted integer: 1,234
export function fmtInt(v: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString('en-US')
}

// Frequency / ratio with 2 decimals: 2.34
export function fmtFreq(v: number | null): string {
  if (v == null) return '—'
  return v.toFixed(2)
}

// Days suffix: "5d"
export function fmtDays(v: number | null): string {
  if (v == null) return '—'
  return `${v}d`
}

// Short date: "Mar 20, 2026"
export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Date + time: "March 20, 4:30 PM" — for appointment display
export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-US', {
    month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

// Long date, no time: "March 20, 2026" — for last-sync labels
export function fmtDateLong(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
