# DenWay Analytics Dashboard

DenWay is a custom analytics dashboard built specifically for DenWay's dental marketing agency operations.

## What It Is

The core idea is simple: the agency runs everything through GoHighLevel — that's where their reps book appointments, manage contacts, track deals, and run pipelines. GoHighLevel does that job fine. But it was never built to answer the questions a business owner actually cares about. Questions like: which rep is performing best this month? How many appointments are showing up vs. no-showing? What does our pipeline actually look like in terms of real revenue potential? Where are leads dropping off?

That's the gap the app fills. It pulls all that operational data out of GoHighLevel and puts it into a proper analytics layer — a clean dashboard that gives the agency a real command center view of their business.

## What You See Day-to-Day

A live performance dashboard showing appointment volume, show rates, rep leaderboards, pipeline value, and conversion metrics — all in one place, updated automatically. Instead of digging through GoHighLevel manually or exporting spreadsheets, the agency opens the dashboard and immediately knows the health of the business.

## Who It's For

The agency owners and managers at DenWay who need to make decisions based on data — not gut feel, not manual reporting, not asking a rep how their week went. It gives them the visibility layer that turns raw activity into actionable insight.

## The Longer-Term Vision

Once the core is solid, the dashboard expands to include ad spend data from Meta, website analytics, and eventually a client-facing portal where DenWay could share performance reports directly with their dental clinic clients. The goal is to become the single place where everything that matters about the agency's performance lives — from rep activity all the way through to client ROI.

**In short: GoHighLevel runs the operations. DenWay's custom app tells you if those operations are actually working.**

---

## Data Sources

| Source | What it provides |
|--------|-----------------|
| GoHighLevel (GHL) | Appointments, contacts, reps, B2C bookings, B2B pipeline deals |
| Meta Marketing API | Ad spend, leads, CPL, ROAS per client |
| Fathom | B2B sales call recordings + AI transcript analysis (objections, outcomes) |

## App Structure

```
/dashboard            Overview KPIs across all clients
/clients              Client list with health indicators (ads + bookings)
/clients/[id]         Client detail: Meta ads + GHL booking performance
/call-center          Rep leaderboard + appointment drill-down
/call-center/[repId]  Rep self-view (reps only see their own page)
/b2b                  Agency sales pipeline: GHL deals + Fathom call analysis
/settings             Admin: manage clients, data sources
```

## Roles

- **Admin/Manager** — full access to all pages and all client/rep data
- **Rep** — can only see their own `/call-center/[repId]` page

---

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to `/login`.

## Required Environment Variables (`.env.local`)

```
# Supabase (server-side, service role — never exposed to browser)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Supabase (client-side auth — safe to expose, anon key only)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# GoHighLevel
GHL_API_KEY=
GHL_ACCESS_TOKEN=

# Meta Ads (long-lived system user token)
META_ACCESS_TOKEN=

# Fathom
FATHOM_API_KEY=

# AI analysis (Anthropic Claude)
ANTHROPIC_API_KEY=
```

## Database Migrations

Run in order via Supabase SQL Editor:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_add_contact_fields.sql
supabase/migrations/003_add_accounts_and_sync_items.sql
supabase/migrations/004_seed_denway_account.sql
supabase/migrations/005_add_user_profiles.sql
supabase/migrations/006_add_meta_snapshots.sql
supabase/migrations/007_add_b2b_and_fathom.sql   ← coming soon
```

## Creating Users

Users are created manually in the Supabase dashboard — no self-signup.

1. **Supabase Dashboard → Authentication → Users → Add User**
2. Set their role via SQL Editor:

**Admin:**
```sql
INSERT INTO user_profiles (id, role) VALUES ('USER_UUID', 'admin');
UPDATE auth.users SET raw_user_meta_data = '{"role":"admin"}' WHERE id = 'USER_UUID';
```

**Rep (link to their rep record):**
```sql
INSERT INTO user_profiles (id, role, rep_id) VALUES ('USER_UUID', 'rep', 'REP_UUID');
UPDATE auth.users SET raw_user_meta_data = '{"role":"rep","rep_id":"REP_UUID"}' WHERE id = 'USER_UUID';
```

## Sync Scripts

```bash
npm run sync:ghl:users    # Sync GHL users → reps table
npm run sync:ghl          # Sync GHL calendar appointments
npm run sync:ghl:calendars
npm run sync:all          # Run all syncs
```

Coming soon:
```bash
npm run sync:meta         # Sync Meta Ads daily snapshots
npm run sync:b2b          # Sync GHL B2B pipeline
npm run sync:fathom       # Sync Fathom calls + AI analysis
```

## GHL Sync Usage

```bash
# Sync users first (enables rep matching on appointments)
npm run sync:ghl:users -- --locationId=<location_id>

# Sync calendar appointments
npm run sync:ghl -- --locationId=<location_id> --calendarId=<calendar_id> --start=2025-01-01 --end=2025-01-31
```
