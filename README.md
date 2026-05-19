# Job Hunter

Personal, browser-based job-hunting web app. Twice-daily scan (07:30 + 17:30 US Pacific) of:
- **Lane A** — career pages of your 15–20 favorite companies via their ATS endpoints (Greenhouse / Lever / Ashby / Workday / generic HTML).
- **Lane B** — broad LinkedIn + Indeed + Glassdoor + ZipRecruiter search via the **JSearch** aggregator API (and optionally Adzuna).

Each new posting is fit-scored by Claude against your profile (LinkedIn export + CV + voice notes + structured preferences). You can tailor a one-click CV for any role and hand off to the company's apply page with the CV link in your clipboard.

Stack: **Next.js 16 (App Router, TS) · Tailwind v4 · Prisma 6 + Postgres (Neon) · NextAuth v5 (Google) · Anthropic Claude · OpenAI Whisper · Vercel (Cron + Blob)**.

---

## Local setup

### 1. Install dependencies

```powershell
cd "C:\Users\valer\.claude\Learning v1\Ueeful stuff\job-hunter"
pnpm install
```

### 2. Set up Neon Postgres

1. Create a free project at https://neon.tech.
2. Copy the connection string (with `?sslmode=require`).
3. Paste it into `.env.local` as `DATABASE_URL`.

### 3. Fill in the rest of `.env.local`

See `.env.example` for the full list. Minimum to run locally:

| Var | Where to get it |
| --- | --- |
| `DATABASE_URL` | Neon |
| `AUTH_SECRET` | any 32+ random characters |
| `ALLOWED_EMAILS` | your Gmail (comma-separated for multi) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | https://console.cloud.google.com → APIs & Services → Credentials → OAuth client (Web). Redirect: `http://localhost:3000/api/auth/callback/google` |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `OPENAI_API_KEY` | https://platform.openai.com (only used by `/api/voice` for Whisper) |
| `RAPIDAPI_KEY` | https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch (free tier OK) |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | https://developer.adzuna.com (optional) |
| `BLOB_READ_WRITE_TOKEN` | optional locally; auto-set on Vercel when you provision Blob |
| `CRON_SECRET` | any random string — the cron route validates this header |

### 4. Run the migration

```powershell
pnpm prisma migrate dev --name init
```

This creates all tables and regenerates the Prisma client.

### 5. Start the dev server

```powershell
pnpm dev
```

Open http://localhost:3000. Sign in with the allowlisted Google account. You'll be sent to `/onboarding`:

1. Upload your LinkedIn data export ZIP (Settings → Data Privacy → Get a copy of your data).
2. Upload your current CV (PDF or DOCX).
3. Paste 15–20 favorite company names.
4. Set role keywords, salary, locations, dealbreakers.

### 6. Trigger a manual scan

```powershell
curl "http://localhost:3000/api/cron/scan?force=1"
```

`?force=1` bypasses the timezone gate. Without `force=1`, the route requires `Authorization: Bearer $CRON_SECRET` (and only runs when local hour is 7 or 17).

---

## Deploy to Vercel

### 1. Push to GitHub

```powershell
git init
git add .
git commit -m "Initial commit"
gh repo create job-hunter --private --source=. --push
```

### 2. Import to Vercel

1. https://vercel.com/new → Import the repo.
2. Framework preset: Next.js (auto-detected).
3. Add **all** env vars from `.env.example` with real values.
4. Update `AUTH_GOOGLE_*` redirect URI in Google Cloud Console to your Vercel URL (`https://<app>.vercel.app/api/auth/callback/google`) and set `NEXTAUTH_URL` to the same hostname.
5. Provision **Vercel Blob** (Storage → Blob → Create) — `BLOB_READ_WRITE_TOKEN` is auto-injected.
6. Deploy.

### 3. Run the production migration

```powershell
$env:DATABASE_URL="<prod-neon-url>"; pnpm prisma migrate deploy
```

### 4. Cron is already configured

`vercel.json` registers four UTC times to cover 07:30 + 17:30 across PST/PDT:
- `30 14 * * *` and `30 0 * * *` (PDT)
- `30 15 * * *` and `30 1 * * *` (PST)

The handler then runs only if the **local** hour is `7` or `17` (DST-safe). Vercel automatically attaches `Authorization: Bearer $CRON_SECRET` if `CRON_SECRET` is set in env.

---

## How the scan works

```
                  /api/cron/scan
                       |
            +----------+----------+
            |                     |
       Lane A: ATS              Lane B: aggregators
       (favorites)              (JSearch + Adzuna)
            |                     |
            +----+ dedupe +-------+
                       |
                  new postings
                       |
              Claude fit scoring
                       |
                 write to DB
```

- Dedupe key: `(normalized company name, normalized title)`. Lane A wins for richer descriptions.
- Lane B hits not in your favorites list auto-create a `Company` row with `isFavorite=false` so the posting still appears in your dashboard.
- Each Claude scoring call uses **prompt caching** on your profile blob — first call pays full price, subsequent calls in the same batch are ~90% cheaper.

---

## Project layout

```
src/
  app/
    page.tsx                    # Dashboard
    login/page.tsx              # Google sign-in
    onboarding/                 # 3-step wizard
    jobs/[id]/                  # Detail + tailor panel
    companies/                  # Add/remove favorites
    search-criteria/            # Preferences form
    profile/                    # LinkedIn / CV / voice notes
    api/
      auth/[...nextauth]/       # NextAuth handler
      cron/scan/                # Twice-daily cron
      companies/                # CRUD + ATS detection
      jobs/[id]/tailor/         # Claude -> PDF + DOCX -> Blob
      voice/                    # MediaRecorder -> Whisper -> preferences merge
      profile/import/           # LinkedIn ZIP + CV upload
  lib/
    ats/                        # Greenhouse, Lever, Ashby, Workday, generic
    aggregators/                # JSearch, Adzuna, dispatcher
    ai/                         # Anthropic client, fit + tailor prompts
    cv/                         # render-pdf.tsx, render-docx.ts, extract.ts
    linkedin/parse.ts           # ZIP CSV parser
    db.ts, env.ts, types.ts, utils.ts, scan.ts, profile-blob.ts
  components/
    ui/                         # Button, Card, Badge, Input (shadcn-style)
    FitRing, JobCard, CompanyLogo, VoiceRecorder, BottomTabBar, TopNav, ThemeToggle, EmptyState, Providers
  middleware.ts                 # Auth gate (everything except /login + /api/auth + /api/cron)
  auth.ts                       # NextAuth + Google + ALLOWED_EMAILS allowlist
prisma/schema.prisma            # DB schema
vercel.json                     # Cron entries
```

---

## Cost expectations (single-user)

| Item | Monthly |
| --- | --- |
| Vercel Hobby | $0 |
| Neon free tier | $0 |
| Vercel Blob | <$1 |
| JSearch (RapidAPI Basic) | $10 |
| Anthropic (Sonnet 4.6 with prompt caching) | $5–15 |
| OpenAI Whisper (~30 min/mo) | <$1 |
| **Total** | **~$15–30** |

If you hit Vercel Hobby's 10s function limit on `/api/cron/scan`, upgrade to Pro for the `maxDuration = 300` headroom this code already specifies.

---

## Roadmap / known limitations

- **Generic HTML adapter** is best-effort; companies on custom career sites will need a dedicated adapter or get auto-flagged `needs_attention`.
- **Workday** sometimes blocks non-browser User-Agents — we set a realistic UA but some tenants still 403.
- **No cover-letter generation yet** — easy to add as a parallel Claude call (same pattern as `tailorCV`).
- **No "Easy Apply" automation** — by design, you review and submit each application yourself.
