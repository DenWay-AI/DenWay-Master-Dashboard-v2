function required(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`Missing required env var: ${key}`)
  return v
}

function optional(key: string, fallback = ''): string {
  return process.env[key] ?? fallback
}

// ─── Supabase ────────────────────────────────────────────────────────────────
export const SUPABASE_URL      = optional('NEXT_PUBLIC_SUPABASE_URL') || optional('SUPABASE_URL')
export const SUPABASE_ANON_KEY = optional('NEXT_PUBLIC_SUPABASE_ANON_KEY')
export const SUPABASE_SERVICE_ROLE_KEY = optional('SUPABASE_SERVICE_ROLE_KEY')

// ─── GoHighLevel ─────────────────────────────────────────────────────────────
export const GHL_CLIENT_ID     = optional('GHL_CLIENT_ID')
export const GHL_CLIENT_SECRET = optional('GHL_CLIENT_SECRET')
export const GHL_REDIRECT_URI  = optional('GHL_REDIRECT_URI')

// DenWay's own GHL location — used to scope B2B ads and strategy sessions
export const DENWAY_GHL_LOCATION_ID = optional('DENWAY_GHL_LOCATION_ID')

// Comma-separated GHL calendar IDs that identify B2B strategy sessions
// If unset, the B2B/B2C split cannot distinguish appointment types
export const DENWAY_STRATEGY_CALENDAR_IDS: string[] = optional('DENWAY_STRATEGY_CALENDAR_IDS')
  .split(',').map(s => s.trim()).filter(Boolean)

// ─── Meta ────────────────────────────────────────────────────────────────────
export const META_ACCESS_TOKEN = optional('META_ACCESS_TOKEN')

// ─── App ─────────────────────────────────────────────────────────────────────
export const APP_URL = optional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
