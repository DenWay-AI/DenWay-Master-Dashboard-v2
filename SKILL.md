# DenWay Dashboard — Developer Guide

This is the **definitive reference for building on the DenWay dashboard correctly**. Read it before touching the codebase. It covers the architecture, conventions, patterns, and hard rules that keep the app consistent and maintainable.

---

## What this app is

A full-stack Next.js analytics dashboard for DenWay, a dental practice growth agency. It pulls data from **GoHighLevel (CRM)**, **Meta Ads**, and **Fathom (video calls)** into **Supabase (Postgres)**, and presents it across two funnels:

- **B2B** — Strategy sessions, enterprise sales, pipeline tracking
- **B2C** — Client consultations, treatment bookings, ad-driven leads

Three user roles: Admin (full access), Rep (call center view only), Client (portal only).

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/andreasskyt/DenWay-Master-Dashboard.git
cd DenWay-Master-Dashboard
npm install
```

### 2. Environment variables

Copy `.env` and fill in values. Required vars:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# GoHighLevel
DENWAY_GHL_PIT=pit-...            # Personal Integration Token for B2B sync
DENWAY_GHL_LOCATION_ID=           # DenWay's GHL location ID
DENWAY_STRATEGY_CALENDAR_IDS=     # Comma-separated calendar IDs for B2B appointments
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
GHL_REDIRECT_URI=http://localhost:3000/api/oauth/callback

# Meta Ads
META_ACCESS_TOKEN=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run locally

```bash
npm run dev          # starts on localhost:3000
```

Dev server does NOT auto-assign a port — if you need a specific port: `npm run dev -- -p 3018`.

### 4. Deploy

**Never deploy to production without asking Thor or Andreas first.** Production deploys via Vercel. Thor or Andreas handles all deploys.

---

## Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 14, App Router | All pages in `src/app/`, all APIs in `src/app/api/` |
| Language | TypeScript (strict) | All new files must be `.ts` / `.tsx` |
| Styling | Tailwind CSS + CSS variables | Tailwind maps to design tokens — see Design System below |
| Database | Supabase (Postgres) | Service role key in API routes, anon key in browser |
| Icons | lucide-react | Consistent throughout — don't add another icon library |
| Font | Geist (sans + mono) | Loaded via `next/font/google` in `layout.tsx` |

---

## Folder structure

```
src/
├── app/
│   ├── api/                  ← All API routes (Next.js route handlers)
│   │   ├── leads/route.ts
│   │   ├── meetings/route.ts
│   │   ├── sync/
│   │   │   └── b2b-appointments/route.ts
│   │   └── ...
│   ├── dashboard/page.tsx    ← Each folder = a page route
│   ├── sales-tracker/page.tsx
│   ├── b2b-ads/page.tsx
│   ├── meetings/page.tsx
│   ├── globals.css           ← Design tokens live here (CSS vars)
│   ├── layout.tsx            ← Root layout — wraps everything in AppShell
│   └── page.tsx              ← Root redirect → /dashboard
├── components/
│   ├── shell/
│   │   └── AppShell.tsx      ← Sidebar + layout wrapper; nav items defined here
│   └── ui/                   ← Reusable primitives — use these, don't invent new ones
│       ├── Modal.tsx
│       ├── KPICard.tsx
│       ├── PageHeader.tsx
│       ├── InlinePicker.tsx
│       └── ...
├── config/
│   ├── tenant.config.ts      ← App name, branding — change here, not in components
│   └── env.ts                ← Typed env var access — import from here
├── lib/
│   ├── formatters.ts         ← All number/date formatting helpers
│   ├── ghl/getToken.ts       ← GHL OAuth token fetch + refresh
│   ├── supabase/
│   │   ├── server.ts         ← Service role client (API routes only)
│   │   └── browser.ts        ← Anon client (client components)
│   └── sync/                 ← GHL + Fathom sync logic (called from API routes)
├── middleware.ts             ← Auth + role-based route guards
scripts/                      ← One-off and cron sync scripts (Node/tsx, not Next.js)
supabase/                     ← DB migrations
```

**The rule:** if it touches the browser, it's in `src/app/` or `src/components/`. If it's a data sync job that runs on a schedule or CLI, it's in `scripts/`.

---

## Design system

### The token file

All colors, spacing, and shadows are defined as CSS variables in `src/app/globals.css`. **Never use raw hex codes or hardcoded pixel values in components** — always use a Tailwind utility class that maps to a token.

Key tokens:

```css
--canvas            /* page background: #0a0a0b */
--surface-1         /* card/panel background */
--surface-2         /* slightly lighter surface */
--surface-3         /* hover states, subtle fill */
--line              /* border color (rgba white at 7%) */
--ink               /* primary text */
--ink-muted         /* secondary text */
--ink-faint         /* placeholder / disabled text */
--accent            /* purple #8b5cf6 — interactive elements, links, focus rings */
--positive          /* green — success, revenue, shows */
--warn              /* amber — warnings, pending */
--negative          /* red — errors, no-shows */
```

### Tailwind class names

Tailwind is configured to consume these tokens. Use these utility classes:

```
bg-canvas, bg-surface-1, bg-surface-2, bg-surface-3
border-line, border-line-strong
text-ink, text-ink-muted, text-ink-faint
text-accent, bg-accent, ring-accent
text-positive, text-warn, text-negative
rounded-card        /* 14px radius — standard card corners */
shadow-panel        /* standard card shadow */
shadow-pop          /* modal / elevated shadow */
```

### Animations

The following entry animations are available (applied as Tailwind classes):

```
animate-fade-up      /* slide + fade in — use on dashboard cards */
animate-fade-in      /* pure fade */
animate-pulse-soft   /* subtle opacity pulse — loading states */
```

Stagger delays for sequential card entry: `delay-1` through `delay-7` (55ms steps).

---

## Reusable components

**Always check `src/components/ui/` before building something from scratch.** If a pattern exists, use it. If a pattern repeats twice in new code, extract it.

| Component | When to use |
|-----------|-------------|
| `Modal` | Any centered dialog/detail view. Pass `maxWidth` (px). |
| `ModalHeader` | Header section inside Modal with border-bottom |
| `ModalBody` | Scrollable body inside Modal |
| `ModalCloseButton` | The × button — always use this, don't roll your own |
| `KPICard` | Any single metric with optional delta. Props: `label`, `value`, `delta`, `valueColor` |
| `PageHeader` | Top of every page. Props: `title`, `subtitle`, `actions` |
| `PageBody` | Padded body content area below PageHeader |
| `InlinePicker` | Dropdown for selecting a value from a list, with a custom trigger element |
| `Button` | Variants: `primary`, `secondary`, `ghost`, `danger` |

### Modal pattern (standard)

Every detail view — whether triggered from a table row, a card, or a button — uses the centered Modal. Never use a side panel.

```tsx
import { Modal, ModalHeader, ModalBody, ModalCloseButton } from '@/components/ui/Modal'

function MyModal({ item, onClose }: { item: Item; onClose: () => void }) {
  return (
    <Modal onClose={onClose} maxWidth={720}>
      <ModalHeader>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.13em', color: 'var(--ink-faint)', marginBottom: 4 }}>
              Record type
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink)' }}>
              {item.name}
            </div>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>
      </ModalHeader>
      <ModalBody>
        {/* content */}
      </ModalBody>
    </Modal>
  )
}
```

Click backdrop → close. Click inside modal → does not close (stopPropagation is wired in the component).

### KPI card grid pattern

```tsx
<div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
  <KPICard label="Total leads"    value={total} />
  <KPICard label="Closed"         value={closed} valueColor="var(--positive)" />
  <KPICard label="Cash collected" value={fmtCurrency(cashIn)} />
</div>
```

Use `size="sm"` when fitting many cards in a row. Use `valueColor` to highlight a metric in a status color.

### Table + row-click-to-modal pattern

```tsx
function MyTable({ items }: { items: Item[] }) {
  const [selected, setSelected] = useState<Item | null>(null)

  return (
    <>
      <div className="rounded-card border border-line bg-surface-1 shadow-panel overflow-x-auto">
        <table className="w-full min-w-[700px] text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-3 text-xs font-medium text-ink-faint">Name</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}
                className="border-b border-line hover:bg-surface-2/60 cursor-pointer transition-colors"
                onClick={() => setSelected(item)}>
                <td className="px-4 py-3 text-sm text-ink">{item.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <MyModal item={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
```

### Detail row pattern (inside modals)

Use `EditRow` for fields the user can click to edit, `DetailRow` for read-only fields. Both live in `sales-tracker/page.tsx` today — if you need them elsewhere, copy or extract them.

```tsx
// Read-only — hides automatically when value is null/empty
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 px-4 py-2 border-b border-line last:border-0">
      <span className="w-32 shrink-0 text-xs text-ink-faint">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  )
}

// Always visible — user can click the value to edit
function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-1.5 border-b border-line last:border-0">
      <span className="w-32 shrink-0 text-xs text-ink-faint pt-1">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// Wrap a group of rows in this container
<div className="rounded-lg border border-line divide-y divide-line bg-surface-2/30">
  <DetailRow label="Email"    value={lead.email} />
  <EditRow   label="Notes">
    <InlineField value={lead.notes} onSave={v => patch({ notes: v })} multiline />
  </EditRow>
</div>
```

**Important:** the `px-4` on rows is required. Without it, labels sit flush against the container border.

### Section headers inside modals

```tsx
<p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
  Section Title
</p>
```

---

## Adding a new page

1. Create `src/app/my-page/page.tsx`
2. Use `'use client'` if the page fetches data or has state
3. Wrap content with `<PageHeader>` and `<PageBody>`
4. Add the nav item to `src/components/shell/AppShell.tsx` in the correct nav group

```tsx
// src/app/my-page/page.tsx
'use client'
import { PageHeader, PageBody } from '@/components/ui/PageHeader'

export default function MyPage() {
  return (
    <>
      <PageHeader title="My Page" subtitle="Description of what this shows" />
      <PageBody>
        {/* content */}
      </PageBody>
    </>
  )
}
```

```tsx
// In AppShell.tsx — add to the appropriate nav group
{ label: 'My Page', href: '/my-page', icon: SomeIcon }
```

---

## Adding a new API route

All routes use the **service role Supabase client** (bypasses RLS — admin-only, never expose to the browser directly).

```typescript
// src/app/api/my-resource/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('my_table')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data })
}

export async function PATCH(req: Request) {
  const supabase = createServerClient()
  const body = await req.json()
  const { id, ...fields } = body

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('my_table')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

**Rules:**
- Always export `dynamic = 'force-dynamic'` on GET routes that read live data
- Always include `updated_at: new Date().toISOString()` in PATCH/PUT updates
- Return `{ error: message }` on failure with appropriate HTTP status
- Never return raw Supabase error objects — just the `.message`

---

## Database conventions

### Tables in use

| Table | What it stores |
|-------|---------------|
| `b2b_leads` | One row per B2B deal/contact. User-managed fields (outcome, qualified, notes, contract value) + auto-synced contact fields. |
| `b2b_meetings` | GHL appointments/calls linked to a lead. Keyed on `ghl_appointment_id`. |
| `b2b_contacts` | Raw GHL contact sync (opportunities, stages). |
| `b2b_sales_tracker` | Appointment-level B2B tracker with UTM attribution. |
| `appointments` | All appointments (B2B + B2C). Keyed on `ghl_appointment_id`. |
| `clients` | B2C client/practice records. |
| `calls` | Call logs with duration, rep, outcome. |
| `fathom_calls` | Fathom recording metadata. |
| `meta_ad_level_insights` | Ad-level spend/impressions/clicks from Meta. |
| `meta_ad_statuses` | Lead-to-ad attribution. |
| `oauth_tokens` | GHL OAuth tokens with expiry + refresh. |
| `reps` | Sales rep profiles. |
| `sync_runs` | Sync audit log. |
| `user_profiles` | Auth user role + rep/client linkage. |

### Upsert pattern (sync routes)

When syncing from an external API, always upsert on the external ID:

```typescript
await supabase
  .from('b2b_meetings')
  .upsert(
    { ghl_appointment_id: ev.id, lead_id: leadId, scheduled_at: ev.startTime, ... },
    { onConflict: 'ghl_appointment_id' }
  )
```

### Never overwrite user-managed fields

When syncing GHL data, some fields are user-managed (the user fills them in via the dashboard). **Do not overwrite these on sync:**

- `b2b_leads`: `call_outcome`, `qualified`, `lead_quality_score`, `contract_value`, `cash_collected`, `deposit`, `offer`, `objection`, `notes`
- `b2b_meetings`: `meeting_notes`, `closer` (overwriting show_status from GHL is fine)

Use `findOrCreateLead()` pattern from `src/lib/sync/b2bGhlSync.ts` as the reference — it inserts only contact/identity fields, never deal fields.

---

## Formatting helpers

Import from `src/lib/formatters.ts`. Never format numbers or dates inline.

```typescript
import { fmtCurrency, fmtCurrencyCompact, fmtInt, fmtPct, fmtDate, fmtDateTime } from '@/lib/formatters'

fmtCurrency(4500)       // "DKK 4,500"
fmtCurrencyCompact(4500) // "DKK 4.5k"
fmtInt(12345)            // "12,345"
fmtPct(0.351)            // "35.1%"
fmtDate('2025-03-18T...')  // "18 Mar '25"
fmtDateTime('...')          // "18 Mar '25, 14:32"
```

For tabular numbers (columns that should align), add class `tnum` — it applies `font-variant-numeric: tabular-nums`.

---

## GHL integration

### Token access

Never read `DENWAY_GHL_PIT` directly in a route. Use the helper:

```typescript
import { getToken } from '@/lib/ghl/getToken'

const token = await getToken('location', locationId) // auto-refreshes if near expiry
```

For the Personal Integration Token (B2B sync), read `process.env.DENWAY_GHL_PIT` directly in sync scripts — those don't need refresh logic.

### Custom field IDs

GHL contacts carry UTM attribution in custom fields. The field ID → key mapping lives in `src/lib/sync/b2bGhlSync.ts` (`UTM_FIELD_MAP`). If DenWay adds a new custom field in GHL, add its ID here.

```typescript
const UTM_FIELD_MAP: Record<string, string> = {
  hXOUrLkIeXLLMTxlVFRc: 'ad_name',
  tKRWYukmP4LkZg4zcdn2: 'ad_set_name',
  pWjbZHb0zasbhPWJPXcV: 'campaign_name',
  // ...
}
```

### Sync scripts

Data sync runs in two modes:

1. **API route** (`src/app/api/sync/*/route.ts`) — triggered by a button in the UI or a webhook. Runs within the Next.js process.
2. **CLI script** (`scripts/cron-*.ts`) — run directly with `npx tsx scripts/cron-b2b-sync.ts`. Intended for cron jobs or manual backfills.

To trigger a sync from the UI, `POST /api/sync/b2b-appointments` with `{ daysBack: N }`.

---

## Auth & roles

Handled in `src/middleware.ts`. Three roles, set in Supabase `user.user_metadata.role`:

| Role | Access |
|------|--------|
| `admin` | Full dashboard |
| `rep` | `/call-center` only |
| `client` | `/portal` only |

To add a new protected route, check whether it should be admin-only. If a rep or client shouldn't see it, the middleware handles it automatically — they're redirected to their restricted path on login.

The login page is `/login`. Standalone (no sidebar) pages are declared in `AppShell.tsx`:

```typescript
const STANDALONE_PATHS = ['/login', '/portal']
```

---

## Inline editing pattern

For fields that users edit directly in a detail modal (click to edit, blur to save):

1. Open the modal with the record data as a prop
2. Keep a `local` state copy for optimistic UI: `const [local, setLocal] = useState(record)`
3. The `patch` function updates local state immediately AND fires a PATCH to the API
4. Use `InlineField`, `InlineCurrency`, `InlineToggle`, or `InlinePicker` for the editable control

```tsx
const patch = useCallback(async (fields: Partial<Lead>) => {
  setLocal(prev => ({ ...prev, ...fields }))          // optimistic
  onUpdate(record.id, fields)                          // bubble up to parent list
  await fetch('/api/leads', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: record.id, ...fields }),
  })
}, [record.id, onUpdate])
```

**What to make editable vs read-only:**
- **Editable**: fields the user fills in (outcome, notes, contract value, contact details)
- **Read-only**: fields auto-synced from GHL (fathom URL, scheduled date, duration, attribution)

---

## TypeScript conventions

- All new files: `.ts` (logic) or `.tsx` (components with JSX)
- Path alias `@/` maps to `src/` — always use it, never relative `../../`
- Run `npx tsc --noEmit` before committing to catch type errors
- Never use `any` unless it's in a sync function dealing with raw GHL/Meta API responses (mark with `eslint-disable-next-line` + a comment explaining why)
- All database row types should match the actual table columns — generate types from Supabase if the schema changes: `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`

---

## Naming conventions

- **Files**: `kebab-case.tsx` for components, `camelCase.ts` for utilities
- **Components**: PascalCase
- **Variables/functions**: camelCase
- **Database columns and custom field keys**: `snake_case`, always in English (never Danish)
- **Tailwind classes**: use semantic token classes (`text-ink-faint`) not raw color utilities (`text-zinc-500`)

---

## The hard rules

These are non-negotiable. Breaking them creates inconsistency that's hard to fix later.

### 1. Design tokens only — no raw values in components
If you're typing `#8b5cf6`, `rgba(0,0,0,0.65)`, or `14px` into a component, you're doing it wrong. Use `var(--accent)`, `var(--line)`, `rounded-card`. The only place raw values belong is in `globals.css` where the tokens are defined.

### 2. All modals are centered — never a side panel
The `Modal` component in `src/components/ui/Modal.tsx` is the only modal chrome in the app. Use it everywhere. Do not build a slide-in side panel.

### 3. Use the reusable components — don't fork them
If `KPICard` doesn't have the prop you need, add the prop to `KPICard`. Don't copy-paste the card markup and style it differently inline.

### 4. Sync logic never overwrites user-managed fields
The `b2b_leads` deal fields (`call_outcome`, `qualified`, `notes`, etc.) are filled in by the user through the dashboard. GHL sync must never reset them. Always `INSERT` on new leads and `UPDATE` only GHL-owned fields on existing ones.

### 5. English identifiers everywhere
Database column names, custom field keys, TypeScript interfaces, API response keys — all in English. User-facing labels in the UI can be in any language, but the underlying keys are always English.

### 6. Never deploy to production without asking Thor or Andreas
Production deploys via Vercel. Do not trigger a production deploy without explicit approval from Thor or Andreas. Build and test locally, then ask.

### 7. All number/date formatting goes through `lib/formatters.ts`
Never `toLocaleString()` or `new Date().toLocaleDateString()` inline in a component. Add a helper to `formatters.ts` if one doesn't exist for your use case.

### 8. API routes use the service role client — pages use the anon client
`createServerClient()` (from `lib/supabase/server.ts`) uses the service role key and bypasses RLS. Use it only in `src/app/api/**`. Pages and components use `createBrowserClient()` which respects session and RLS.

---

## Common patterns cheat sheet

### Fetch data in a client component

```tsx
const [data, setData] = useState<Item[]>([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  fetch('/api/my-resource')
    .then(r => r.json())
    .then(d => setData(d.items ?? []))
    .finally(() => setLoading(false))
}, [])
```

### Badge component (no import needed — inline it)

```tsx
function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
```

Status badge colors:
```
Showed / Closed / Yes  → bg-emerald-50 text-emerald-700
No Show / No           → bg-red-50 text-red-600
Pending / Follow-up    → bg-blue-50 text-blue-700
Cancelled / No Sale    → bg-zinc-100 text-zinc-600
Reschedule / Warning   → bg-amber-50 text-amber-700
```

### Format a date

```typescript
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}
```

### Section label (inside a modal or card)

```tsx
<p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
  Section Name
</p>
```

### Loading state in a table

```tsx
{loading && (
  <tr>
    <td colSpan={N} className="py-12 text-center text-sm text-ink-faint">Loading…</td>
  </tr>
)}
{!loading && rows.length === 0 && (
  <tr>
    <td colSpan={N} className="py-12 text-center text-sm text-ink-faint">No data yet.</td>
  </tr>
)}
```

---

## Git workflow

```bash
git checkout -b feature/my-feature    # always branch from main
# make changes
npx tsc --noEmit                      # type-check before committing
git add src/...                       # add specific files, not git add -A
git commit -m "Short description of what and why"
git push origin feature/my-feature
# open a PR → Thor or Andreas reviews → merges
```

**Commit message format:**
- Start with a verb: `Add`, `Fix`, `Update`, `Remove`, `Refactor`
- One sentence describing the change
- If it fixes a bug, mention what was broken: `Fix lead modal padding — labels were flush against border`

---

## What NOT to do

- Don't hardcode `#8b5cf6` or any hex color in a component — use `var(--accent)` or the Tailwind token class
- Don't build a slide-in side panel — all record views are centered modals
- Don't call Supabase directly in a page component — fetch from an API route
- Don't use `any` in TypeScript unless dealing with raw external API responses
- Don't add a new icon library — lucide-react is the one
- Don't write Danish variable names, object keys, or column names
- Don't overwrite `call_outcome`, `qualified`, `notes`, or other user-managed fields during GHL sync
- Don't skip `npx tsc --noEmit` before pushing — broken types break the build
- Don't deploy to production without asking Thor or Andreas

---

## Questions?

Ask Thor or Andreas. They've built every part of this codebase and know the decisions behind the patterns.
