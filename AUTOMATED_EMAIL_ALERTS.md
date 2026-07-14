# Automated Email Alert System

**EF Architects and Engineers Consulting PLC — Contract Administration Portal**

This document describes the automated email notification subsystem built into the portal.
It scans the database daily for near-expiring contractor bonds and approaching EOT deadlines,
then dispatches HTML alert emails to the relevant parties with a cooldown shield to prevent
duplicate sends.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Migrations](#database-migrations)
4. [How the Cron Job Works](#how-the-cron-job-works)
5. [Cooldown Shield Logic](#cooldown-shield-logic)
6. [Email Templates](#email-templates)
7. [Secure Token-Protected Notice Pages](#secure-token-protected-notice-pages)
8. [Public API Routes](#public-api-routes)
9. [Recipient Routing](#recipient-routing)
10. [Environment Variables](#environment-variables)
11. [Vercel Cron Configuration](#vercel-cron-configuration)
12. [Diagnostics Log](#diagnostics-log)
13. [File Reference](#file-reference)
14. [Running Migrations](#running-migrations)
15. [Local Testing](#local-testing)

---

## Overview

Every morning at **08:00 AM Addis Ababa time (05:00 UTC)**, Vercel automatically calls
`GET /api/cron/email-alerts`. The route is protected by a bearer token secret. It then:

- Scans `project_bonds` for all Active bonds expiring in **30, 15, or 7 days**
- Scans `eot_tracker` for all approved EOT records whose revised completion date is **30 or 15 days** away
- For each qualifying record, dispatches a beautifully designed HTML alert email
- Stamps a cooldown marker so the same threshold is never emailed twice in 24 hours
- Mints a secure UUID token and writes it to the record — the email button links to a private single-record notice page
- Appends a diagnostics row to `system_cron_logs` with the full run summary

---

## Architecture

```
Vercel Cron (05:00 UTC daily)
        │
        ▼
GET /api/cron/email-alerts
        │  validates Authorization: Bearer <CRON_SECRET>
        ▼
lib/alert-scanner.ts  ─────────────────────────────────────────┐
        │                                                       │
        ├── scanBonds()                                         │
        │     • queries project_bonds WHERE status='Active'     │
        │     • filters by days remaining vs thresholds         │
        │     • applies cooldown shield                         │
        │     • mints UUID view_token (7-day expiry)            │
        │     • calls bondExpiryWarningEmailHtml()              │
        │     • sends via sendNotificationEmail()               │
        │     • updates project_bonds (token + cooldown cols)   │
        │                                                       │
        ├── scanEots()                                          │
        │     • queries eot_tracker                             │
        │     • same flow as bonds, EOT thresholds              │
        │     • mints UUID view_token (7-day expiry)            │
        │     • calls eotDeadlineWarningEmailHtml()             │
        │     • sends via sendNotificationEmail()               │
        │     • updates eot_tracker (token + cooldown cols)     │
        │                                                       │
        └── writeCronLog()                                      │
              • inserts row into system_cron_logs               │
              └───────────────────────────────────────────────┘

Email received → recipient clicks notice link
        │
        ▼
/notice/bond/[token]  OR  /notice/eot/[token]
        │  (public, no login required)
        ▼
/api/public/bond/[token]  OR  /api/public/eot/[token]
        │  validates UUID format + checks token_expires_at > NOW()
        │  returns only the matching single record
        ▼
Notice page renders: bond/EOT details only — nothing else exposed
```

---

## Database Migrations

Run these SQL files in order against your Supabase project. All files live in the project root.

| File | Purpose |
|---|---|
| `add_alert_tracking_columns.sql` | Adds `last_notified_at` + `notified_warning_threshold` to `project_bonds` and `eot_tracker` |
| `add_view_tokens.sql` | Adds `view_token` (UUID) + `token_expires_at` to both tables, with indexes |
| `add_notice_interaction_columns.sql` | Adds `renewal_note` + `renewal_submitted_at` to `project_bonds`; `progress_note` + `progress_updated_at` to `eot_tracker` |
| `create_system_cron_logs.sql` | Creates the `system_cron_logs` diagnostics table |

### Columns added to `project_bonds`

| Column | Type | Purpose |
|---|---|---|
| `last_notified_at` | `TIMESTAMPTZ` | When the last automated alert was sent for this bond |
| `notified_warning_threshold` | `INTEGER` | Which threshold (7, 15, or 30) was last sent |
| `view_token` | `UUID` | Single-use private token embedded in the alert email link |
| `token_expires_at` | `TIMESTAMPTZ` | Token becomes invalid after this timestamp (7 days from send) |
| `renewal_note` | `TEXT` | Free-text message submitted by the contractor on the notice page |
| `renewal_submitted_at` | `TIMESTAMPTZ` | When the contractor submitted the renewal form |

### Columns added to `eot_tracker`

| Column | Type | Purpose |
|---|---|---|
| `last_notified_at` | `TIMESTAMPTZ` | When the last automated advisory was sent |
| `notified_warning_threshold` | `INTEGER` | Which threshold (15 or 30) was last sent |
| `view_token` | `UUID` | Single-use private token embedded in the advisory email link |
| `token_expires_at` | `TIMESTAMPTZ` | Token becomes invalid after 7 days |
| `progress_note` | `TEXT` | Site progress note logged by department head via notice page |
| `progress_updated_at` | `TIMESTAMPTZ` | When the progress note was last saved |

### `system_cron_logs` table

| Column | Type | Purpose |
|---|---|---|
| `id` | `BIGSERIAL` | Primary key |
| `job_name` | `VARCHAR(100)` | Always `'email-alerts'` |
| `status` | `VARCHAR(20)` | `'success'` / `'partial'` / `'error'` |
| `bonds_sent` | `INTEGER` | Number of bond alert emails dispatched |
| `eots_sent` | `INTEGER` | Number of EOT advisory emails dispatched |
| `total_sent` | `INTEGER` | `bonds_sent + eots_sent` |
| `errors_count` | `INTEGER` | Number of send or DB failures |
| `detail` | `TEXT` | Per-record log lines (one per bond/EOT processed) |
| `executed_at` | `TIMESTAMPTZ` | When the cron run started |

---

## How the Cron Job Works

### 1. Route protection

`GET /api/cron/email-alerts` checks:

```
Authorization: Bearer <CRON_SECRET>
```

Vercel injects this header automatically on scheduled runs. Any request without the correct
secret receives `401 Unauthorized`. If `CRON_SECRET` is not set in the environment, the route
returns `500` and refuses to execute — it fails closed, not open.

### 2. Bond scan

Queries all `project_bonds` where `status = 'Active'` and `expiry_date IS NOT NULL`.

For each bond, calculates `daysRemaining` using Ethiopia timezone (`Africa/Addis_Ababa`)
to ensure date arithmetic is not skewed by the UTC offset at execution time.

Thresholds checked: **30 days → 15 days → 7 days**

### 3. EOT scan

Queries all `eot_tracker` records where `revised_completion_date IS NOT NULL`.

Thresholds checked: **30 days → 15 days**

### 4. Token minting

Before sending each email, a fresh `crypto.randomUUID()` token is generated with a 7-day
expiry. This is written to the database **only after** the email sends successfully.
The token URL is embedded in the email as the notice page link.

### 5. DB stamping

On successful send, the following columns are updated atomically:

```
last_notified_at           = NOW()
notified_warning_threshold = <threshold>
view_token                 = <new UUID>
token_expires_at           = NOW() + 7 days
```

### 6. Response

The cron route returns a JSON summary:

```json
{
  "status": "SUCCESS",
  "bondsSent": 3,
  "eotsSent": 2,
  "totalSent": 5,
  "errorsCount": 0,
  "durationMs": 1842,
  "executedAt": "2026-07-14T05:00:00.000Z"
}
```

---

## Cooldown Shield Logic

The `shouldNotify()` function in `lib/alert-scanner.ts` prevents duplicate emails.

### Rules

1. **Find the qualifying threshold** — the smallest threshold value that is `≥ daysRemaining`.
   Example: 12 days remaining → qualifies for the 15-day threshold.

2. **Skip if already sent at this threshold within 24 hours** — if `notified_warning_threshold`
   equals the qualifying threshold AND `last_notified_at` is less than 24 hours ago, skip.

3. **Skip if already escalated to a more urgent threshold** — if `notified_warning_threshold`
   is smaller than the qualifying threshold (e.g. already sent a 7-day notice but the
   qualifying threshold is 15), skip. You never go backwards in urgency.

4. **Always send on threshold escalation** — if `daysRemaining` has dropped into a more
   urgent window since the last send (e.g. 30-day notice was sent, now at 6 days), always send.

### Reset policy

| Event | Reset behaviour |
|---|---|
| Bond renewed (new `expiry_date` written) | `notified_warning_threshold = 0`, `last_notified_at = NULL` — full cycle restarts |
| EOT extended (new `revised_completion_date`) | Same reset |
| New alert sent | `notified_warning_threshold` updated to new threshold, `last_notified_at` stamped |

---

## Email Templates

Both templates live in `lib/alert-emails.ts`. They use inline CSS for email client
compatibility and are fully mobile-responsive via a centered table layout.

### A — Bond Expiry Warning (`bondExpiryWarningEmailHtml`)

- **Header:** Dark navy `#1E3A8A` banner with urgency badge
- **Urgency badge colours:**
  - 7 days or fewer → Red `#DC2626` — **CRITICAL**
  - 8–15 days → Amber `#D97706` — **HIGH PRIORITY**
  - 16–30 days → Blue `#2563EB` — **ADVANCE NOTICE**
- **Body:** Contractor greeting, urgency countdown block, bond details table
  (Project, Employer, Bond Type, Expiry Date, Days Remaining, Amount)
- **Action block:** Plain text reminder to contact the Contract Administration Department
  *(CTA button commented out — to be re-enabled in next update)*
- **Footer:** EF corporate details and confidentiality notice

### B — EOT Deadline Advisory (`eotDeadlineWarningEmailHtml`)

- **Header:** Slate grey `#475569` banner — marked as **Internal Advisory**
- **Same urgency badge logic** as bonds
- **Body:** Department head greeting, urgency countdown, EOT details table
  (Project, Client, Contractor, Claim No., Days Approved, Revised Deadline)
- **Action block:** Plain text reminder to verify site progress
  *(CTA button commented out — to be re-enabled in next update)*
- **Footer:** Confidential internal notice

> **Note:** Both CTA buttons (`Submit Bond Renewal Documentation` and `View Project Tracking
> Dashboard`) are currently commented out in the HTML template. Plain text reminder blocks
> replace them. The buttons and their linked notice pages are complete and tested — they will
> be re-enabled in the next update. The `// TODO` comment marks each disabled block.

---

## Secure Token-Protected Notice Pages

When the CTA buttons are re-enabled, each email will contain a unique private link of the form:

```
https://your-app.vercel.app/notice/bond/<uuid>
https://your-app.vercel.app/notice/eot/<uuid>
```

### Security properties

| Property | Detail |
|---|---|
| **Token space** | UUID v4 — 2¹²² possible values, not guessable by enumeration |
| **Expiry** | 7 days from send — old links become dead automatically |
| **Single record** | The API returns only the one matching record — no other data accessible |
| **No authentication** | Recipient does not need a portal account to view their notice |
| **Search engine blocked** | `robots: noindex, nofollow` on both pages |
| **One-time use (bond)** | Token is nulled after the contractor submits a renewal |
| **Multi-use (EOT)** | Token stays valid for the full 7 days — department head can update progress note multiple times |

### Bond notice page — `/notice/bond/[token]`

Displays the single bond record for the token. Includes a functional **renewal submission form**:

- **New Issue Date** (optional)
- **New Expiry Date** (required, must be a future date)
- **Message to Contract Administration** (optional, 500 chars)

On submit: updates `expiry_date`, `status → Active`, stamps `renewal_submitted_at`,
writes `renewal_note`, and **invalidates the token** so the link cannot be reused.

### EOT notice page — `/notice/eot/[token]`

Displays the single EOT record. Includes:

- **EOT Window Progress timeline** — a visual bar showing % of the approved extension
  window elapsed, with colour coding (green → amber at 70% → red at 90%)
- **Three metric chips:** Extension Granted / Days Remaining / Time Used %
- **Site Progress Note form** — department head logs current execution status
  (1000 chars, can be updated multiple times, each submission overwrites the previous)

---

## Public API Routes

All routes under `/api/public/` are unauthenticated. They are secured exclusively by
the UUID token mechanism described above.

| Route | Method | Description |
|---|---|---|
| `/api/public/bond/[token]` | `GET` | Returns the single bond record for a valid, non-expired token. Strips `token_expires_at` from the response. |
| `/api/public/eot/[token]` | `GET` | Returns the single EOT record for a valid, non-expired token. |
| `/api/public/bond/[token]/submit` | `POST` | Accepts `new_expiry_date` (required), `new_issue_date` (optional), `renewal_note` (optional). Updates bond, invalidates token. |
| `/api/public/eot/[token]/progress` | `POST` | Accepts `progress_note` (required, max 1000 chars). Stamps `progress_note` + `progress_updated_at`. Token remains valid. |

All routes validate the UUID format with a regex before touching the database and return
intentionally vague 404 responses for invalid/expired tokens to prevent oracle attacks.

---

## Recipient Routing

### Bond alert emails

| Recipient | Source |
|---|---|
| Primary `To` | `assigned_manager_email` on the `project_bonds` row |
| CC | `DGM_EMAIL` env var |
| CC | `CONTRACT_ADMIN_EMAIL` env var |
| CC | `REMINDER_RECIPIENTS` env var (comma-separated) |

Duplicate addresses are removed before sending. Invalid email addresses (failed regex) are
silently dropped with a log entry rather than crashing the run.

### EOT advisory emails

Same routing as bonds — `assigned_manager_email` on the `eot_tracker` row is the primary
recipient, with the same CC list.

---

## Environment Variables

Add these to your `.env` (local) and Vercel Environment Variables dashboard (production).

```env
# ── Cron security ────────────────────────────────────────────
# Bearer token Vercel sends in the Authorization header for cron calls.
# Generate: openssl rand -hex 32
# Or: https://generate-secret.vercel.app/32
CRON_SECRET=your-strong-random-secret

# ── Alert email recipients ───────────────────────────────────
# Base URL of the deployment — used in notice page token links
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Deputy General Manager — CC'd on all bond and EOT alerts
DGM_EMAIL=dgm@efae.com

# Contract Administration Department Head — CC'd on all alerts
CONTRACT_ADMIN_EMAIL=contract.admin@efae.com

# Additional comma-separated CC recipients (optional)
REMINDER_RECIPIENTS=recipient1@efae.com,recipient2@efae.com

# ── Email transport (one or both) ───────────────────────────
# Resend API key (primary transport)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# Gmail SMTP fallback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-gmail@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-gmail@gmail.com
SMTP_FROM_NAME=EF Architect and Engineering
```

---

## Vercel Cron Configuration

Configured in `vercel.json` at the project root:

```json
{
  "crons": [
    {
      "path": "/api/send-reminders",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/email-alerts",
      "schedule": "0 5 * * *"
    }
  ]
}
```

`0 5 * * *` = **05:00 UTC = 08:00 AM Addis Ababa (UTC+3)** every day.

Vercel automatically injects the `Authorization: Bearer <CRON_SECRET>` header on scheduled
invocations. The cron route rejects any request that does not carry this exact header.

> Vercel Cron Jobs require a **Pro plan** or higher. The `maxDuration` on the route is set
> to 60 seconds, which is the Pro plan limit for cron functions.

---

## Diagnostics Log

Every cron run — successful or not — appends one row to `system_cron_logs`. Query it in
the Supabase SQL Editor to monitor runs:

```sql
-- Last 10 runs
SELECT job_name, status, bonds_sent, eots_sent,
       total_sent, errors_count, executed_at
FROM system_cron_logs
ORDER BY executed_at DESC
LIMIT 10;

-- Check detail lines for a specific run
SELECT detail
FROM system_cron_logs
WHERE executed_at::date = CURRENT_DATE
ORDER BY executed_at DESC
LIMIT 1;
```

Example `detail` output:

```
[bonds] ✓ Sent 30d warning for "Ring Road Overpass A4" → admin@efae.com (30 days remaining)
[bonds] ✓ Sent 15d warning for "Entoto Park Extension" → admin@efae.com (15 days remaining)
[bonds] ✓ Sent 7d warning for "Bole Road Upgrade Phase II" → admin@efae.com (7 days remaining)
[eots]  ✓ Sent 30d advisory for "Lideta Commercial Complex" (Claim #1) → admin@efae.com
[eots]  ✓ Sent 15d advisory for "Gerji Mixed-Use Tower" (Claim #3) → admin@efae.com
```

---

## File Reference

```
app/
├── api/
│   ├── cron/
│   │   └── email-alerts/
│   │       └── route.ts          # Cron controller — auth + orchestration
│   └── public/
│       ├── bond/[token]/
│       │   ├── route.ts          # GET — fetch single bond by token
│       │   └── submit/
│       │       └── route.ts      # POST — submit bond renewal
│       └── eot/[token]/
│           ├── route.ts          # GET — fetch single EOT by token
│           └── progress/
│               └── route.ts      # POST — save site progress note
└── notice/
    ├── bond/[token]/
    │   └── page.tsx              # Public bond notice page + renewal form
    └── eot/[token]/
        └── page.tsx              # Public EOT notice page + progress form

lib/
├── alert-emails.ts               # HTML email templates (bond + EOT)
└── alert-scanner.ts              # Scan engine, cooldown logic, token minting

SQL migrations (run in Supabase SQL Editor):
├── add_alert_tracking_columns.sql
├── add_view_tokens.sql
├── add_notice_interaction_columns.sql
└── create_system_cron_logs.sql
```

---

## Local Testing

### Prerequisites

1. Run all four SQL migrations in Supabase SQL Editor
2. Set `CRON_SECRET=local-dev-test-secret-2024` in `.env`
3. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `.env`
4. Set `CONTRACT_ADMIN_EMAIL` in `.env`
5. Start dev server: `pnpm dev`

### Seed test data

```sql
INSERT INTO project_bonds
  (employer_name, project_name, contractor_name, bond_type,
   issue_date, expiry_date, amount, status, assigned_manager_email)
VALUES
  ('Addis Ababa City Admin', 'Bole Road Upgrade Phase II',
   'Teklu Construction PLC', 'Performance Bond',
   CURRENT_DATE - INTERVAL '180 days', CURRENT_DATE + INTERVAL '7 days',
   1250000, 'Active', 'your@email.com'),
  ('Ministry of Works', 'Entoto Park Extension',
   'Habesha Builders Ltd', 'Advance Payment Bond',
   CURRENT_DATE - INTERVAL '165 days', CURRENT_DATE + INTERVAL '15 days',
   875000, 'Active', 'your@email.com'),
  ('Ethiopian Roads Authority', 'Ring Road Overpass A4',
   'Nile Construction Group', 'Performance Bond',
   CURRENT_DATE - INTERVAL '150 days', CURRENT_DATE + INTERVAL '30 days',
   3400000, 'Active', 'your@email.com');

INSERT INTO eot_tracker
  (client_name, project_name, contractor_name, eot_number,
   days_approved, revised_completion_date, status,
   reason_for_eot, eot_status_alert, assigned_manager_email)
VALUES
  ('Addis Ababa City Admin', 'Gerji Mixed-Use Tower',
   'Teklu Construction PLC', 3, 45,
   CURRENT_DATE + INTERVAL '15 days', 'Approved',
   'Delayed delivery of structural steel from supplier.',
   'Nearly Expired', 'your@email.com'),
  ('Ministry of Works', 'Lideta Commercial Complex',
   'Habesha Builders Ltd', 1, 30,
   CURRENT_DATE + INTERVAL '30 days', 'Approved',
   'Unforeseen subsurface water table found during foundation works.',
   'Nearly Expired', 'your@email.com');
```

### Fire the cron

```powershell
(iwr "http://localhost:3000/api/cron/email-alerts" -Method GET -Headers @{ "Authorization" = "Bearer local-dev-test-secret-2024" }).Content
```

**Expected:**
```json
{"status":"SUCCESS","bondsSent":3,"eotsSent":2,"totalSent":5,"errorsCount":0}
```

### Test cooldown (run again immediately)

```powershell
(iwr "http://localhost:3000/api/cron/email-alerts" -Method GET -Headers @{ "Authorization" = "Bearer local-dev-test-secret-2024" }).Content
```

**Expected:** `bondsSent: 0, eotsSent: 0` — cooldown blocked all re-sends.

### Test auth guard

```powershell
iwr "http://localhost:3000/api/cron/email-alerts" -Method GET -Headers @{ "Authorization" = "Bearer wrong-secret" }
# Expected: 401 Unauthorized
```

### Verify tokens in DB

```sql
SELECT project_name, view_token, token_expires_at,
       token_expires_at > NOW() AS is_valid
FROM project_bonds
WHERE view_token IS NOT NULL;
```

### Check diagnostics

```sql
SELECT job_name, status, bonds_sent, eots_sent, total_sent, errors_count, executed_at
FROM system_cron_logs
ORDER BY executed_at DESC
LIMIT 5;
```

### Reset for re-testing

```sql
UPDATE project_bonds
SET last_notified_at = NULL, notified_warning_threshold = 0,
    view_token = NULL, token_expires_at = NULL
WHERE assigned_manager_email = 'your@email.com';

UPDATE eot_tracker
SET last_notified_at = NULL, notified_warning_threshold = 0,
    view_token = NULL, token_expires_at = NULL
WHERE assigned_manager_email = 'your@email.com';
```

---

*Document last updated: July 2026*
*System built as part of the EF Contract Administration Portal — Phase 2*
