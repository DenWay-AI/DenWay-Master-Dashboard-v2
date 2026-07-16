# Meta Ads Integration Setup Guide

How to connect Meta (Facebook) Ads data to the DenWay app so ad spend, leads, CPL, CPS, and CPP show up on the Clients dashboard.

---

## Overview of What You're Setting Up

- A **System User** in Meta Business Manager (acts like a service account — it doesn't expire when someone leaves the company)
- A **long-lived access token** for that system user
- The **Ad Account ID** for each client (links their ad account to their client record in the app)

---

## Step 1 — Make Sure You Have Business Manager Access

1. Go to [business.facebook.com](https://business.facebook.com)
2. Make sure you're in **DenWay's Business Manager** (top-left dropdown)
3. You need **Admin** access. If you're not an admin, ask whoever manages the Meta account.

---

## Step 2 — Create a System User

A System User is a non-human account used for API access. It won't break if a team member leaves.

1. In Business Manager, go to **Settings** (gear icon, bottom-left)
2. In the left sidebar click **Users → System Users**
3. Click **Add**
4. Give it a name: `DenWay App Sync`
5. Set role to **Admin**
6. Click **Create System User**

---

## Step 3 — Give the System User Access to Each Client's Ad Account

For every client whose ads you want to sync:

1. Still in Business Manager → **Accounts → Ad Accounts**
2. Find the client's ad account and click on it
3. Click **Add People**
4. Search for `DenWay App Sync` (the system user you just created)
5. Set role to **Analyst** (read-only is enough; use Advertiser only if you need to)
6. Click **Confirm**

Repeat for every client ad account.

---

## Step 4 — Generate the Access Token

1. Go back to **Settings → Users → System Users**
2. Click on **DenWay App Sync**
3. Click **Generate New Token**
4. Select your app from the dropdown (if you don't have a Meta App yet, see the note below)
5. Under **Permissions**, enable these two:
   - `ads_read` ← required to read spend, impressions, clicks
   - `ads_management` ← required to read lead counts from campaign actions
6. Click **Generate Token**
7. **Copy the token immediately** — it will only be shown once

> **Don't have a Meta App yet?**
> Go to [developers.facebook.com](https://developers.facebook.com) → My Apps → Create App → choose **Business** type. Name it `DenWay Sync`. Once created, come back here and it will appear in the dropdown in step 4.

> **Token expiry:** System User tokens generated this way are **long-lived (never expire)** as long as the system user remains active. You do not need to refresh them.

---

## Step 5 — Add the Token to the App

Open the file `.env.local` in the root of the project and add this line:

```
META_ACCESS_TOKEN=your_token_here
```

Replace `your_token_here` with the token you copied in Step 4.

The file should look something like this (among other variables):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
META_ACCESS_TOKEN=EAA...long_string_here
```

Save the file.

---

## Step 6 — Find Each Client's Ad Account ID

The Ad Account ID is a number that looks like `act_1234567890`. Here's how to find it:

1. Go to [adsmanager.facebook.com](https://adsmanager.facebook.com)
2. In the top-left, switch to the **client's ad account** using the account switcher
3. Look at the URL in your browser — it will contain the account ID:
   ```
   https://adsmanager.facebook.com/adsmanager/accounts?act=1234567890
   ```
   The number after `act=` is the account ID. Prefix it with `act_`:
   ```
   act_1234567890
   ```

**Alternative:** In Business Manager → Accounts → Ad Accounts, the ID is listed under the account name.

---

## Step 7 — Add Each Client's Ad Account ID in the App

1. Open the app and go to **Clients**
2. Click on a client name to open their detail page
3. Scroll down to the **Links & Integrations** section
4. Paste the Ad Account ID (e.g. `act_1234567890`) into the **Meta Ad Account ID** field
5. Click **Save**

Repeat for every client you want to sync ads data for.

---

## Step 8 — Run the Migration in Supabase

This only needs to be done once. It adds the `meta_ad_account_id` column to the clients table.

1. Go to your [Supabase dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**
4. Paste and run this query:

```sql
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS meta_ad_account_id TEXT;
```

5. Click **Run** — you should see "Success. No rows returned."

---

## Step 9 — Test the Sync

Run a test sync for one client first:

```bash
npm run sync:meta -- --clientId=<the-client-uuid>
```

You can find a client's UUID in the URL when you open their detail page in the app (e.g. `/clients/2def2b19-...`).

If it works you'll see output like:

```
🔄 Syncing Meta ads for 1 client(s)…

→ Skoulas DDS (act_1234567890)
  Fetching 2025-12-24 → 2026-03-24
  ✅ 90 days upserted (90 from API)

✅ Done — 90 rows upserted, 0 clients failed
```

Once confirmed, run for all clients:

```bash
npm run sync:meta
```

---

## Step 10 — Ongoing Syncing

Meta ads data is now included in every **Sync All** run. Just click **↻ Sync All** in the app and it will pull the latest Meta data alongside GHL.

The sync is incremental — it always fetches from 2 days before the last snapshot (to catch any retroactive Meta updates) up to today.

---

## Troubleshooting

**"Missing META_ACCESS_TOKEN"**
→ You haven't added the token to `.env.local` yet. See Step 5.

**"No clients with meta_ad_account_id found"**
→ You haven't set the Ad Account ID on any client yet. See Steps 6–7.

**Meta API error [200]: (#200) The user hasn't authorized the application**
→ The system user doesn't have access to that ad account. Go back to Step 3 and add the system user to the specific ad account.

**Meta API error [100]: Invalid ad account id**
→ The Ad Account ID is in the wrong format. Make sure it includes the `act_` prefix (e.g. `act_1234567890` not just `1234567890`).

**Meta API error [190]: Invalid OAuth access token**
→ The token was entered incorrectly or the system user was deleted. Re-generate the token (Step 4) and update `.env.local`.

**Spend shows but leads show 0**
→ Leads are pulled from the `actions` field in Meta's API. This requires the campaign to be using a Lead objective or Lead form. If leads are tracked as website conversions only, they won't appear here — contact Meta support or check the campaign objective.

---

## Summary Checklist

- [ ] Created System User `DenWay App Sync` in Business Manager
- [ ] Added system user to each client's ad account (Analyst role)
- [ ] Generated token with `ads_read` + `ads_management` scopes
- [ ] Added `META_ACCESS_TOKEN=...` to `.env.local`
- [ ] Ran SQL migration in Supabase (migration 014)
- [ ] Added `meta_ad_account_id` for each client in the app
- [ ] Tested sync with `npm run sync:meta`
