# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # start dev server (http://localhost:3000)
pnpm build        # production build
pnpm lint         # ESLint (eslint.config.mjs, eslint-config-next)
pnpm db:migrate   # apply DB migrations and regenerate client (loads .env.local)
pnpm db:studio    # GUI to inspect Neon Postgres tables
pnpm db:generate  # regenerate client after schema changes without migrating
```

**Manually trigger a scan (bypasses cron schedule and auth):**
```powershell
curl.exe "http://localhost:3000/api/cron/scan?force=1"
```
Use `curl.exe` (not `curl`) in PowerShell to avoid the Invoke-WebRequest alias.

**TypeScript check without building:**
```powershell
.\node_modules\.bin\tsc --noEmit
```

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

### AI calls (`src/lib/ai/`)

All Claude calls use the tool-use pattern with `tool_choice: { type: "tool", name }` to get structured JSON output reliably. `extractJson<T>()` in `claude.ts` handles both tool-use blocks and fallback JSON text blocks.

- `fit.ts` — `scoreFit()`: returns `FitOutput` (fitScore, interviewProbability, strengths, gaps, reasoning). Uses `MODEL_PRIMARY` (`claude-sonnet-4-6`) with the profile blob prompt-cached in the system message.
- `tailor.ts` — `tailorCV()`: returns `TailoredCVStructure` JSON. Same caching pattern. Profile is the source of truth — the prompt explicitly forbids inventing credentials.
- `claude.ts` exports `MODEL_PRIMARY = "claude-sonnet-4-6"` and `MODEL_FAST = "claude-haiku-4-5-20251001"`. Haiku is used only in the voice route.

### Profile blob (`src/lib/profile-blob.ts`)

`buildProfileBlob()` condenses the stored profile (LinkedIn JSON, CV text, voice notes) into a single string <8k tokens for use as the cached system-message context in all Claude calls. `readPreferences()` casts the raw JSON to `Preferences`.

### CV generation (`src/lib/cv/`)

- `extract.ts`: PDF → `unpdf` (serverless-safe, avoids pdfjs-dist worker issues). DOCX → `mammoth`.
- `render-pdf.tsx`: `@react-pdf/renderer` template, runs server-side (no Chromium).
- `render-docx.ts`: `docx` npm package.

Both upload to Vercel Blob if `BLOB_READ_WRITE_TOKEN` is set; otherwise `pdfBlobUrl`/`docxBlobUrl` are stored as `null`.

### Auth (`src/auth.ts`)

Single-passphrase `Credentials` provider (JWT strategy). `APP_PASSWORD` is compared directly. First successful login upserts a `User` row using `APP_USER_EMAIL`. The middleware in `src/middleware.ts` gates all routes except `/login`, `/api/auth/*`, and `/api/cron/*`.

### Cron DST safety (`src/app/api/cron/scan/route.ts`)

`vercel.json` has 4 UTC cron entries covering PST and PDT. The handler uses `Intl.DateTimeFormat` to check the current Pacific hour and skips if not in `[7, 17]`. Pass `?force=1` to bypass both the auth header check and the timezone gate.

### Data model

Key relationships: `User → Profile` (1:1), `Company → JobPosting[]` (1:many), `JobPosting → FitAssessment` (1:1 optional), `JobPosting → TailoredCV[]` (1:many). Dedup constraint on `Company.normalizedName` and `(companyId, externalId, source)` on `JobPosting`.

`Profile.preferences` and `Profile.voiceNotes` are stored as `Json` columns and cast to `Preferences` / `VoiceNote[]` at read time — no Prisma type safety there, use the helpers in `profile-blob.ts`.

### Styling

Tailwind v4 with CSS variable design tokens. `cn()` from `src/lib/utils.ts` merges class names. Dark mode default via `next-themes`; `ThemeToggle` uses a `mounted` guard to avoid hydration mismatches. `sonner` for toasts. Framer Motion for `FitRing` (animated SVG donut) and card transitions.

### Important quirks

- `TagInput` (`src/components/TagInput.tsx`) is used for all multi-value string fields (role keywords, locations, must-haves, dealbreakers). Press Enter or comma to commit a chip; Backspace removes the last chip.
- Seniority is stored as `SeniorityLevel[]` (array), not a single string. The `SENIORITY_LEVELS` constant in `src/lib/types.ts` is the source of truth for valid values.
- All API routes set `export const runtime = "nodejs"` — they must not accidentally run on the Edge runtime (pdfjs/unpdf, Prisma, etc. are Node-only).
- `pnpm-workspace.yaml` has `allowBuilds` entries for `@prisma/client`, `@prisma/engines`, `prisma`, `sharp`, and `unrs-resolver` to satisfy pnpm 11's strict build isolation policy.
