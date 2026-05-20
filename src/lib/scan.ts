import pLimit from "p-limit";
import { db } from "@/lib/db";
import { fetchCompanyJobs } from "@/lib/ats";
import { fetchAggregatorPostings } from "@/lib/aggregators";
import { scoreFit } from "@/lib/ai/fit";
import { buildProfileBlob, readPreferences } from "@/lib/profile-blob";
import { normalizeCompanyName, normalizeJobTitle } from "@/lib/utils";
import { filterPosting } from "@/lib/profile-hardcoded";
import type { AggregatorPosting, RawPosting } from "@/lib/types";
import type { Company, JobSource, Prisma } from "@prisma/client";

const SCRAPE_CONCURRENCY = 5;
const SCORE_CONCURRENCY = 3;

// Per-call bounds. Each phase must finish well inside Vercel's 60s function
// limit (Hobby plan), so the /api/scan route runs ONE bounded phase per call
// and the client loops until each phase reports `remaining: 0`.
export const FETCH_BATCH = 15; // companies scraped per "fetch" call
export const SCORE_BATCH = 20; // postings scored per "score" call

type PersistItem = { companyId: string; raw: RawPosting; source: JobSource };

// Persist via createMany + skipDuplicates — one call per chunk instead of a
// findFirst + create round-trip per posting. The (companyId, externalId,
// source) unique constraint lets skipDuplicates drop ones already stored.
// Returns the number of rows actually inserted.
async function persistPostings(items: PersistItem[]): Promise<number> {
  if (items.length === 0) return 0;
  const rows: Prisma.JobPostingCreateManyInput[] = items.map((i) => ({
    companyId: i.companyId,
    externalId: i.raw.externalId,
    title: i.raw.title,
    normalizedTitle: normalizeJobTitle(i.raw.title),
    location: i.raw.location,
    remote: i.raw.remote,
    salaryText: i.raw.salaryText,
    salaryMin: i.raw.salaryMin,
    salaryMax: i.raw.salaryMax,
    salaryCurrency: i.raw.salaryCurrency,
    url: i.raw.url,
    descriptionMd: i.raw.descriptionMd,
    postedAt: i.raw.postedAt,
    source: i.source,
  }));
  let created = 0;
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const res = await db.jobPosting.createMany({
      data: rows.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    created += res.count;
  }
  return created;
}

// A company is "due" for a Lane A scrape if it has never been scraped or its
// per-company interval has elapsed.
function isDue(c: Company): boolean {
  if (!c.lastScrapedAt) return true;
  const intervalMs = (c.scanIntervalDays ?? 1) * 24 * 60 * 60 * 1000;
  return Date.now() - c.lastScrapedAt.getTime() >= intervalMs;
}

// ──────────────────────────────────────────────────────────────────────────
// Phase: aggregators (Lane B). Runs once per scan.
// ──────────────────────────────────────────────────────────────────────────
export type AggregatorPhaseResult = { phase: "aggregators"; newCount: number; error?: string };

export async function runAggregatorPhase(userId: string): Promise<AggregatorPhaseResult> {
  const profile = await db.profile.findUnique({ where: { userId } });
  const preferences = readPreferences(profile);

  let postings: AggregatorPosting[] = [];
  let error: string | undefined;
  try {
    postings = await fetchAggregatorPostings(preferences);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const items: PersistItem[] = [];
  for (const agg of postings) {
    const company = await getOrCreateCompany(agg.companyNameRaw);
    items.push({ companyId: company.id, raw: stripAggregatorFields(agg), source: agg.source });
  }
  const newCount = await persistPostings(items);
  return { phase: "aggregators", newCount, error };
}

// ──────────────────────────────────────────────────────────────────────────
// Phase: fetch one batch of due companies (Lane A).
// ──────────────────────────────────────────────────────────────────────────
export type FetchBatchResult = {
  phase: "fetch";
  scraped: number;
  remaining: number;
  newCount: number;
  errors: { name: string; error: string }[];
};

export async function runFetchBatch(batchSize = FETCH_BATCH): Promise<FetchBatchResult> {
  const active = await db.company.findMany({ where: { active: true } });
  const due = active
    .filter(isDue)
    .sort((a, b) => (a.lastScrapedAt?.getTime() ?? 0) - (b.lastScrapedAt?.getTime() ?? 0));
  const batch = due.slice(0, batchSize);

  const limit = pLimit(SCRAPE_CONCURRENCY);
  const items: PersistItem[] = [];
  const errors: { name: string; error: string }[] = [];

  await Promise.all(
    batch.map((company) =>
      limit(async () => {
        try {
          const raws = await fetchCompanyJobs(company);
          for (const r of raws) items.push({ companyId: company.id, raw: r, source: "favorite_scrape" });
          await db.company.update({
            where: { id: company.id },
            data: { lastScrapedAt: new Date(), lastError: null },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push({ name: company.name, error: msg });
          await db.company.update({
            where: { id: company.id },
            data: { lastScrapedAt: new Date(), lastError: msg },
          });
        }
      }),
    ),
  );

  const newCount = await persistPostings(items);
  return {
    phase: "fetch",
    scraped: batch.length,
    remaining: Math.max(0, due.length - batch.length),
    newCount,
    errors,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Phase: score one batch of dashboard-eligible unscored postings.
// ──────────────────────────────────────────────────────────────────────────
export type ScoreBatchResult = { phase: "score"; scored: number; remaining: number };

export async function runScoreBatch(userId: string, batchSize = SCORE_BATCH): Promise<ScoreBatchResult> {
  const profile = await db.profile.findUnique({ where: { userId } });
  const preferences = readPreferences(profile);
  const profileBlob = buildProfileBlob(profile);

  // Only score postings that would actually appear on the dashboard — scoring
  // filtered-out roles wastes Claude spend. Newest first so fresh roles score
  // promptly; old filtered-out junk never enters the batch.
  const window = await db.jobPosting.findMany({
    where: { assessment: null, status: { in: ["new", "reviewed", "selected", "applied"] } },
    include: { company: true },
    orderBy: { firstSeenAt: "desc" },
    take: 1500,
  });
  const eligible = window.filter((p) =>
    filterPosting({
      title: p.title,
      location: p.location,
      remote: p.remote,
      salaryMax: p.salaryMax,
      source: p.source,
    }).keep,
  );
  const batch = eligible.slice(0, batchSize);

  const limit = pLimit(SCORE_CONCURRENCY);
  let scored = 0;
  await Promise.all(
    batch.map((p) =>
      limit(async () => {
        try {
          const fit = await scoreFit({
            profileBlob,
            preferences,
            posting: {
              company: p.company.name,
              title: p.title,
              location: p.location,
              salaryText: p.salaryText,
              descriptionMd: p.descriptionMd,
            },
          });
          await db.fitAssessment.create({
            data: {
              jobPostingId: p.id,
              fitScore: Math.round(fit.fitScore),
              interviewProbability: Math.round(fit.interviewProbability),
              strengths: fit.strengths as unknown as Prisma.InputJsonValue,
              gaps: fit.gaps as unknown as Prisma.InputJsonValue,
              reasoning: fit.reasoning,
              modelUsed: "claude-sonnet-4-6",
            },
          });
          scored++;
        } catch (e) {
          console.error("[fit-score]", p.id, e);
        }
      }),
    ),
  );

  return { phase: "score", scored, remaining: Math.max(0, eligible.length - scored) };
}

// ──────────────────────────────────────────────────────────────────────────
// All-in-one orchestration. Used by the /api/cron/scan debug endpoint and for
// local runs. NOT used by the dashboard button — that drives the phases above
// directly so each HTTP call stays inside the 60s function limit.
// ──────────────────────────────────────────────────────────────────────────
export type ScanReport = {
  startedAt: string;
  finishedAt: string;
  laneBAggregators: { newCount: number; error?: string };
  companiesScraped: number;
  totalNew: number;
  totalScored: number;
  unscoredEligibleRemaining: number;
};

export async function runScan(userId: string): Promise<ScanReport> {
  const startedAt = new Date();

  const agg = await runAggregatorPhase(userId);
  let totalNew = agg.newCount;

  let companiesScraped = 0;
  for (let i = 0; i < 50; i++) {
    const r = await runFetchBatch();
    companiesScraped += r.scraped;
    totalNew += r.newCount;
    if (r.remaining <= 0) break;
  }

  let totalScored = 0;
  let unscoredEligibleRemaining = 0;
  for (let i = 0; i < 200; i++) {
    const r = await runScoreBatch(userId);
    totalScored += r.scored;
    unscoredEligibleRemaining = r.remaining;
    if (r.remaining <= 0) break;
    if (r.scored === 0) break; // persistent failures — stop looping
  }

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    laneBAggregators: { newCount: agg.newCount, error: agg.error },
    companiesScraped,
    totalNew,
    totalScored,
    unscoredEligibleRemaining,
  };
}

async function getOrCreateCompany(rawName: string): Promise<Company> {
  const normalized = normalizeCompanyName(rawName);
  const found = await db.company.findUnique({ where: { normalizedName: normalized } });
  if (found) return found;
  return db.company.create({
    data: {
      name: rawName,
      normalizedName: normalized,
      atsType: "unknown",
      isFavorite: false,
      active: false, // Lane B hits aren't scraped in Lane A
    },
  });
}

function stripAggregatorFields(a: AggregatorPosting): RawPosting {
  return {
    externalId: a.externalId,
    title: a.title,
    location: a.location,
    remote: a.remote,
    salaryText: a.salaryText,
    salaryMin: a.salaryMin,
    salaryMax: a.salaryMax,
    salaryCurrency: a.salaryCurrency,
    url: a.url,
    descriptionMd: a.descriptionMd,
    postedAt: a.postedAt,
  };
}
