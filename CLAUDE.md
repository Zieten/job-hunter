# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # start dev server on http://localhost:3000 — runs `next dev --no-turbopack`
pnpm build        # production build
pnpm lint         # ESLint (eslint.config.mjs, eslint-config-next)
pnpm db:migrate   # apply DB migrations and regenerate client (wraps `dotenv -e .env.local -- prisma migrate dev`)
pnpm db:studio    # GUI to inspect Neon Postgres tables
pnpm db:generate  # regenerate client after schema changes without migrating
```

**Always use the `pnpm db:*` scripts, not `pnpm dlx prisma ...`** — `dlx` pulls Prisma 7 which is incompatible with the installed `@prisma/client` 6.19.

**Turbopack is intentionally disabled** in `pnpm dev`. It OOMs in this repo, partly because of a stray `C:\Users\valer\pnpm-lock.yaml` that caused it to watch the entire user profile. `next.config.ts` pins `turbopack.root` to the repo dir as a secondary guard. If you ever re-enable Turbopack, delete that stray lockfile first.

**Manually trigger a scan (bypasses cron schedule and auth):**
```powershell
curl.exe "http://localhost:3000/api/cron/scan?force=1"
curl.exe "http://localhost:3000/api/cron/discover?force=1"
```
Use `curl.exe` (not `curl`) in PowerShell to avoid the Invoke-WebRequest alias.

**TypeScript check without building:**
```powershell
.\node_modules\.bin\tsc --noEmit
```

## Deployment

Live: https://job-hunter-nu-rust.vercel.app (Vercel Hobby plan, branch `main` of `github.com/Zieten/job-hunter`). Production crons fire from `vercel.json` (see schedule below). Manual triggers work against the prod URL with the same `?force=1` query string.

## Environment variables (`.env.local`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres pooled connection string |
| `AUTH_SECRET` | NextAuth JWT signing secret |
| `APP_PASSWORD` | Single passphrase for login |
| `APP_USER_EMAIL` | Email stored for the owner user row |
| `ANTHROPIC_API_KEY` | Claude API (fit scoring + CV tailoring + voice prefs) |
| `OPENAI_API_KEY` | Whisper transcription only |
| `RAPIDAPI_KEY` | JSearch aggregator (Lane B) |
| `CRON_SECRET` | Bearer token for production cron calls |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob for PDF/DOCX storage (optional locally) |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Optional second aggregator |

CV upload and tailoring work locally without `BLOB_READ_WRITE_TOKEN`; blob URLs are just skipped.

## Architecture

### Two-lane job scan (`src/lib/scan.ts`)

The core orchestration runs on a Vercel Cron twice daily (07:30 + 17:30 US Pacific). Both lanes execute in parallel and results are deduped before persistence.

- **Lane A — favorites** (`src/lib/ats/`): Fetches job listings from ATS APIs for each `Company` marked `isFavorite=true, active=true`. The dispatcher in `ats/index.ts` routes by `company.atsType` to the correct adapter (Greenhouse, Lever, Ashby, Workday, generic HTML/Cheerio). ATS detection (`ats/detect.ts`) can auto-discover a careers page from a company name by probing known ATS URL patterns.

- **Lane B — aggregators** (`src/lib/aggregators/`): Queries JSearch (RapidAPI) and optionally Adzuna with the user's `Preferences` (role keywords, locations, salary floor). Both are only invoked if their env vars are present. Two more always-on queries run alongside JSearch using the same `RAPIDAPI_KEY`:
  - `german-us.ts` — searches for US-presence titles (Country Manager US, Head of US, US BizDev, US Growth, etc.) and post-filters to German-origin firms via (a) a curated seed list of ~20 mid-size German scaleups, (b) `.de` apply/employer URLs, or (c) explicit "headquartered in Germany / Berlin / Munich" phrases in the description. Tagged as `aggregator_german_us`.
  - `indeed-de.ts` — same US-presence intent, queried against `de.indeed.com` via the **Indeed12** scraper on RapidAPI (host `indeed12.p.rapidapi.com`). Runs **two parallel queries per scan** — one English title set ("Head of US", "Country Manager US", etc.) and one German title set ("Geschäftsführer USA", "Leiter USA", "Vertriebsleitung USA", "Markteintritt USA", etc.) — then dedupes by `externalId`. Trusted as a German-firm signal by source — no extra filter. Defensive parser (`mapHit`) accepts several plausible field-name variants since RapidAPI Indeed providers differ. Tagged as `aggregator_indeed_de`. **Requires a separate RapidAPI subscription to Indeed12** (free tier ~500 req/month; usage ≈ 120/month at 2 scans/day).

- **Dedupe key**: `normalizeCompanyName(name) + "::" + normalizeJobTitle(title)`. Lane A wins over Lane B when the same role appears in both. Lane B hits auto-create `Company` rows with `isFavorite=false, active=false`.

- **Fit scoring**: After persisting new postings, unscored ones are scored in `pLimit(3)` batches via Claude (`src/lib/ai/fit.ts`). The profile blob is prompt-cached to save ~70% on input tokens.

### Hardcoded search profile (`src/lib/profile-hardcoded.ts`)

**This module is the single source of truth for what counts as a match.** It is shared between two places that previously diverged:

- **Dashboard filter** (`src/app/page.tsx`) calls `filterPosting({ title, location, remote, salaryMax, source })` to decide whether to render each tile. The DB query stays broad (`status IN (...)`, take 1000); all precision happens in JS via this module. The DB-stored `Profile.preferences` blob is **no longer read** at filter time.
- **Fit-scoring prompt** (`src/lib/ai/fit.ts`) embeds `HARDCODED_PREFS_PROMPT` inside the cached system message so Claude scores against the same constraints the dashboard filters against. Treat the module as the override — if it conflicts with the profile blob, the module wins.

`HARD_FILTER` defines the strict gates (geography, role-function keywords, seniority, comp floor, dealbreakers). `SOFT_PREFERENCES` defines scoring-only signals (preferred verticals, deprioritized verticals, German-firm boost). `DASHBOARD.fitScoreCutoff` (currently 60) gates the dashboard render.

**German-firm bypass**: postings with `source IN (aggregator_german_us, aggregator_indeed_de)` bypass the role/seniority/comp gates (since first-US-hire titles and comp norms vary), are accepted anywhere in North America, and get a `+15` boost when checked against the cutoff. Helpers: `isGermanSource()`, `filterPosting()`.

Tune the profile by editing this one file — no schema or UI changes required.

### AI calls (`src/lib/ai/`)

All Claude calls use the tool-use pattern with `tool_choice: { type: "tool", name }` to get structured JSON output reliably. `extractJson<T>()` in `claude.ts` handles both tool-use blocks and fallback JSON text blocks.

- `fit.ts` — `scoreFit()`: returns `FitOutput` (fitScore, interviewProbability, strengths, gaps, reasoning). Uses `MODEL_PRIMARY` (`claude-sonnet-4-6`). The cached system message contains `HARDCODED_PREFS_PROMPT` (from `profile-hardcoded.ts`) plus the profile blob — both rarely change, so one cache hit covers the whole scan batch.
- `tailor.ts` — `tailorCV()`: returns `TailoredCVStructure` JSON. Same caching pattern. Profile is the source of truth — the prompt explicitly forbids inventing credentials.
- `claude.ts` exports `MODEL_PRIMARY = "claude-sonnet-4-6"` and `MODEL_FAST = "claude-haiku-4-5-20251001"`. Haiku is used only in the voice route.

### Profile blob (`src/lib/profile-blob.ts`)

`buildProfileBlob()` condenses the stored profile (LinkedIn JSON, CV text, voice notes) into a single string <8k tokens for use as the cached system-message context in all Claude calls. `readPreferences()` casts the raw JSON to `Preferences` — still used by the aggregator query builders (JSearch role keywords, locations) but **no longer authoritative for filtering or scoring**; see `profile-hardcoded.ts` for that.

### CV generation (`src/lib/cv/`)

- `extract.ts`: PDF → `unpdf` (serverless-safe, avoids pdfjs-dist worker issues). DOCX → `mammoth`.
- `render-pdf.tsx`: `@react-pdf/renderer` template, runs server-side (no Chromium).
- `render-docx.ts`: `docx` npm package.

Both upload to Vercel Blob if `BLOB_READ_WRITE_TOKEN` is set; otherwise `pdfBlobUrl`/`docxBlobUrl` are stored as `null`.

### Auth — edge / node split (`src/auth.config.ts` + `src/auth.ts`)

NextAuth v5 config is **split across two files** so the edge middleware bundle stays under Vercel's 1 MB limit (it was 1.02 MB when Prisma got pulled in transitively):

- `auth.config.ts` — **edge-safe**, zero Node/Prisma imports. Exports a minimal `authConfig` (JWT strategy, signIn page, jwt+session callbacks). `src/middleware.ts` consumes this directly.
- `auth.ts` — full Node config. Spreads `...authConfig`, adds the `Credentials` provider and the DB upsert. Used by route handlers, server components, and the `auth()` helper.

Single-passphrase login: `APP_PASSWORD` compared directly. First successful login upserts a `User` row keyed on `APP_USER_EMAIL`. The middleware gates all routes except `/login`, `/api/auth/*`, and `/api/cron/*`.

**When editing auth, never import from `@/lib/db` or any Prisma-touching module inside `auth.config.ts` — it will silently swell the edge bundle past the 1 MB limit and the next Vercel deploy fails.**

### Manual triggers (no cron schedule)

There are **no scheduled crons** — `vercel.json`'s `crons` array is empty. Both jobs run on demand from buttons on the dashboard (`src/components/ScanControls.tsx`).

| Trigger | Endpoint | Auth | What it does |
|---|---|---|---|
| **Run scan** button | `POST /api/scan` | NextAuth session (middleware-gated) | `runScan(userId)` — Lane A + Lane B + fit scoring |
| **Discover companies** button | `POST /api/discover` | NextAuth session (middleware-gated) | `runDiscovery()` — Series C/D company hunt |
| CLI debug | `GET /api/cron/scan?force=1` | None (bypasses auth) | Same scan, kept for `curl.exe` testing |
| CLI debug | `GET /api/cron/discover?force=1` | None (bypasses auth) | Same discovery, kept for `curl.exe` testing |

The discovery worker lives in `src/lib/discover.ts` (`runDiscovery()`) so the new authenticated route and the legacy `/api/cron/discover` route can both call it without duplication. Scan logic remains in `src/lib/scan.ts` (`runScan(userId)`).

To re-enable scheduled scans later, add entries back to `vercel.json` pointing at `/api/cron/scan` (the `?force=1`-bypassing GET handler is still present) and restore the Pacific-hour gate if desired.

### Growth company discovery (`src/lib/aggregators/growth-discovery.ts` + `src/app/api/cron/discover/route.ts`)

A weekly job that grows the company watchlist. Queries JSearch for `"Series C"` and `"Series D"` postings combined with BD/Sales/GTM role terms (Business Development, VP Sales, Head of Sales, Go-to-Market, AE, Revenue Operations, Sales Director, CRO), extracts unique employer names, and upserts them as `Company` rows with:

- `fundingStage = "Series C"` or `"Series D"`
- `scanIntervalDays = 14` (biweekly — they're not favorites, so Lane A throttles them)
- `isFavorite = false`, `active = true`

The `/companies` page renders these in a separate "Growth-stage" section with a purple `fundingStage` badge so they're visually distinct from manually-curated favorites.

### Data model

Key relationships: `User → Profile` (1:1), `Company → JobPosting[]` (1:many), `JobPosting → FitAssessment` (1:1 optional), `JobPosting → TailoredCV[]` (1:many). Dedup constraint on `Company.normalizedName` and `(companyId, externalId, source)` on `JobPosting`.

`Profile.preferences` and `Profile.voiceNotes` are stored as `Json` columns and cast to `Preferences` / `VoiceNote[]` at read time — no Prisma type safety there, use the helpers in `profile-blob.ts`.

`JobSource` enum has 5 values: `favorite_scrape`, `aggregator_jsearch`, `aggregator_adzuna`, `aggregator_german_us`, `aggregator_indeed_de`. Adding a value requires a migration; the dashboard's source label switch in `JobCard.tsx` and the German-source helper in `profile-hardcoded.ts` (`GERMAN_SOURCES`) must both be updated.

`Company` also stores `scanIntervalDays` (1 = daily, 14 = biweekly — used by Lane A to throttle low-priority companies) and `fundingStage` (free-text label, e.g. "Series C").

### Styling

Tailwind v4 with CSS variable design tokens. `cn()` from `src/lib/utils.ts` merges class names. Dark mode default via `next-themes`; `ThemeToggle` uses a `mounted` guard to avoid hydration mismatches. `sonner` for toasts. Framer Motion for card transitions and the standalone `FitRing` (animated SVG donut, used on the job detail page).

**Dashboard tiles** (`JobCard.tsx`) use a compact responsive grid (`1/2/3/4/5` columns across breakpoints). The fit signal is encoded three ways for at-a-glance triage: (1) a 4px color stripe down the left edge (green ≥80, amber 60–79, red <60, gray unscored), (2) a colored number pill top-right, (3) a one-line italic "✓ &lt;top strength&gt;" caption from the fit assessment. Logos are intentionally absent on the dashboard — they're shown on the detail page only. The `fitTone()` helper in `JobCard.tsx` is the single source of color tokens; keep it in sync if the cutoff in `profile-hardcoded.ts` changes.

### Important quirks

- `TagInput` (`src/components/TagInput.tsx`) is used for all multi-value string fields (role keywords, locations, must-haves, dealbreakers). Press Enter or comma to commit a chip; Backspace removes the last chip.
- Seniority is stored as `SeniorityLevel[]` (array), not a single string. The `SENIORITY_LEVELS` constant in `src/lib/types.ts` is the source of truth for valid values.
- All API routes set `export const runtime = "nodejs"` — they must not accidentally run on the Edge runtime (pdfjs/unpdf, Prisma, etc. are Node-only).
- `pnpm-workspace.yaml` has `allowBuilds` entries for `@prisma/client`, `@prisma/engines`, `prisma`, `sharp`, and `unrs-resolver` to satisfy pnpm 11's strict build isolation policy.
