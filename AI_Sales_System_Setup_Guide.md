# AI Sales Call System — Setup Guide

This workflow automatically processes every sales call you record in Fathom. For each call it:
- Transcribes and classifies the call (niche, outcome, objections)
- Extracts prospect info (name, business, city, email)
- Writes a call summary and coaching notes
- Logs everything to a Notion database
- Links the record to the contact in GoHighLevel

---

## What You Need Before Starting

| Tool | What It's For | Get It At |
|---|---|---|
| **Fathom** | Records and transcribes your calls | fathom.video |
| **Notion** | Database where calls get logged | notion.so |
| **GoHighLevel (GHL)** | CRM — workflow links call notes to contacts | your GHL account |
| **Anthropic API** | Powers the AI classification + summaries | console.anthropic.com |
| **n8n** | Runs the automation (self-hosted or cloud) | n8n.io |

---

## Step 1 — Gather Your API Keys

You'll paste these into the **SET vars** node (first node after the trigger).

### Fathom API Key
1. Log into Fathom → Settings → Integrations → API
2. Generate a new API key
3. Copy it → paste into `FATHOM_API_KEY`

### Notion Integration Token
1. Go to [notion.so/my-integrations](https://notion.so/my-integrations) → New Integration
2. Name it (e.g. "Sales System"), select your workspace
3. Copy the **Internal Integration Token** → paste into `NOTION_INTEGRATION_TOKEN`

### Notion Database ID
1. Open your Notion database (see Step 2 to create it first)
2. Copy the URL — it looks like: `notion.so/94f5574ff71a433298bc4a477a452de0?v=...`
3. The long hex string between the last `/` and the `?` is your database ID
4. Paste it into `NOTION_MEETINGS_DB_ID`

### GHL API Key
1. In GHL → Settings → Integrations → API Keys
2. Create a new key with read/write access
3. Paste into `GHL_API_KEY`

### GHL Sub-account ID
1. In GHL → Settings → Business Info
2. Copy the **Location ID** (also visible in the URL when inside your sub-account)
3. Paste into `GHL_SUBACCOUNT_ID`

### Anthropic API Key
1. Go to console.anthropic.com → API Keys → Create Key
2. Paste into `ANTHROPIC_API_KEY`
3. Make sure your account has billing set up — the AI steps use Claude Sonnet

---

## Step 2 — Create Your Notion Database

Create a new full-page database in Notion with these exact property names and types:

| Property Name | Type | Notes |
|---|---|---|
| Call Title | **Title** | Auto-filled |
| Date Start | Date | |
| Date End | Date | |
| Recorded By | Text | |
| Prospect Name | Text | |
| Center Name | Text | Name of their business |
| City | Text | |
| Prospect Email | Email | |
| Participant Emails | Text | |
| Niche | **Select** | Add options: `[YOUR_NICHE]`, `[SECONDARY_NICHE]`, `Other` |
| Status | **Select** | Add options: `Closed`, `Lost`, `No Show`, `Follow Up` |
| Objections | **Multi-select** | Add options (see Step 4) |
| Call Summary | Text | |
| Follow-up Steps | Text | |
| Follow-up Message | Text | |
| Follow-up Date | Date | |
| Contract Tier | Select | Add options matching your tiers (e.g. `Small`, `Medium`, `Large`) |
| Fathom Recording ID | Text | |
| Fathom URL | URL | |
| Has Transcript | Checkbox | |
| GHL Contact ID | Text | |

**After creating the database:**
- Click Share → Invite → find your integration → give it full access

---

## Step 3 — Find and Replace All Placeholders

Open each node listed below and replace the placeholder text with your own values.

### In the `SET vars` node
All credentials go here. See Step 1.

---

### In `AI — Classify Call (Niche + Closed + Tier)`

**YOUR_NICHE_TITLE_PATTERNS** — these are meeting title patterns that tell the system "this is a sales call for my niche." Replace the example patterns with your own:

```js
const YOUR_NICHE_TITLE_PATTERNS = [
  /dental growth call/i,
  /dental discovery/i,
  // add more patterns that match how your sales calls are titled in Fathom
];
```

**In the AI prompt**, replace:
- `[YOUR_NICHE]` → your primary niche (e.g. `dental`)
- `[SECONDARY_NICHE]` → a second niche if you serve one (or delete that line)
- `[YOUR_NICHE_UNIT]` → the unit for sizing (e.g. `chairs`, `locations`, `staff`) — used for contract tiers
- `[SALES_REP]` → your name, first name only

The contract tier detection block classifies prospects by size. Update these to match your tiers:
```js
// Example — change the sizes to whatever makes sense for your business
- contract_tier: "small" if the business has 1-5 [units], "medium" if 5-20, "large" if 20+
```

---

### In `AI — Extract Prospect Info`

Replace:
- `[YOUR_NICHE]` → your niche (used in the extraction prompt)
- `YOUR_AGENCY_DOMAIN.com` → your actual agency domain (e.g. `myagency.com`)
  This is used to identify which call participant is the prospect vs. you.

---

### In `AI — Generate Call Summary (Two-Pass)`

Replace:
- `[YOUR_NICHE]` → your niche
- `[YOUR_AGENCY]` → your agency name
- `[SALES_REP]` → your name

---

### In `AI — Extract Objections + Handling`

Replace:
- `[YOUR_NICHE]` → your niche
- `[SALES_REP_NAME]` → your full name
- `[YOUR_AGENCY]` → your agency name
- `[SALES_REP]` → your first name (in the rebuttal prompts)

---

### In `AI — Generate Follow-up Steps + Message`

Replace:
- `[YOUR_NICHE]` → your niche
- `[YOUR_AGENCY]` → your agency name
- `[SALES_REP_NAME]` → your full name
- `[SALES_REP]` → your first name

---

### In `Create Notion Page with All Properties`

**OWN_DOMAIN** — replace with your agency's email domain:
```js
const OWN_DOMAIN = 'youragency.com';
```
This tells the system which participant in the call is you (so it extracts the *prospect's* email, not yours).

**VALID_OBJECTIONS** — replace with the objection labels you want to track. These must exactly match the Multi-select options you added to Notion:
```js
const VALID_OBJECTIONS = [
  'Price too high',
  'Already have someone',
  'Need to think about it',
  'Not the right time',
  'Too busy',
  'Not interested',
  // add/remove to match what you actually hear
];
```

---

### In `Search GHL Contact by Email (Best-Effort)`

Replace `YOUR_AGENCY_DOMAIN.com` with your agency domain (same as above).

---

## Step 4 — Set Your Objection Labels

The objection labels appear in two places and must match exactly:

1. **Notion database** — in the `Objections` multi-select property, add each label as an option
2. **`Create Notion Page` node** — in the `VALID_OBJECTIONS` array in the code

Default labels (change these to whatever you actually hear from prospects):
- Price too high
- Already have someone
- Need to think about it
- Not the right time
- Too busy
- Not interested

---

## Step 5 — Configure the Schedule

The workflow runs every **8 hours** by default. To change this:
1. Open the **Schedule Trigger** node
2. Adjust the interval to whatever suits you (e.g. every 4 hours, once a day)

The `SINCE_DAYS` variable in SET vars controls how far back it looks on the first run (default: 100 days). After the first sync, it only processes new meetings so you can leave this as-is.

`MAX_PER_RUN` limits how many calls it processes per execution (default: 50). Fine to leave unless you have very high call volume.

---

## Step 6 — Test It

1. Make sure you have at least one recorded call in Fathom that matches your title patterns
2. In n8n, open the workflow and click **Test workflow** (do NOT activate it yet)
3. Watch each node run — check the output of **AI — Classify Call** to confirm it's detecting your niche correctly
4. Open your Notion database — you should see a new page appear with all fields filled
5. If it looks good, click **Activate** to turn on the schedule

---

## How to Know It's Working

After activation, every sales call you record in Fathom will automatically appear in Notion within 8 hours (or sooner depending on your schedule). Each record will have:

- Full call summary
- Outcome status (Closed / Follow Up / No Show / Lost)
- Objections raised
- Prospect info (name, business, city, email)
- Follow-up steps written by the AI
- A draft follow-up message
- Link to the Fathom recording
- GHL contact linked (if email match found)

---

## Troubleshooting

| Problem | Check |
|---|---|
| No calls appearing in Notion | Fathom API key correct? Meeting title matches your `YOUR_NICHE_TITLE_PATTERNS`? |
| All calls classified as "other" | Update title patterns in `AI — Classify Call` — they must match how Fathom titles your meetings |
| GHL not linking | GHL API key and Sub-account ID correct? Prospect email must exist as a contact in GHL |
| AI nodes failing | Check `ANTHROPIC_API_KEY` is valid and has billing. Check Anthropic console for errors |
| Notion pages missing fields | Property names in Notion must match exactly (case-sensitive) what's in the code |
