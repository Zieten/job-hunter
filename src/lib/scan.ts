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
// Score at most this many postings per scan (Vercel route maxDuration is 300s;
// at pLimit(3) concurrency this comfortably fits the time budget).
const FIT_SCORE_CAP = 120;

export type ScanReport = {
  startedAt: string;
  finishedAt: string;
  laneAFavorites: { companyId: string; name: string; ok: boolean; newCount: number; error?: string }[];
  laneBAggregators: { newCount: number; error?: string };
  totalNew: number;
  totalScored: number;
  // Dashboard-eligible postings still awaiting a fit score after this scan.
  // When > 0, run the scan again to score the rest.
  unscoredEligibleRemaining: number;
};

export async function runScan(userId: string): Promise<ScanReport> {
  const startedAt = new Date();
  const profile = await db.profile.findUnique({ where: { userId } });
  const preferences = readPreferences(profile);
  const profileBlob = buildProfileBlob(profile);

  const toScrape = await db.company.findMany({ where: { active: true } });

  // --- Lane A: scrape all active companies (respecting per-company cadence) ---
  const limit = pLimit(SCRAPE_CONCURRENCY);
  const laneAReport: ScanReport["laneAFavorites"] = [];
  const laneAPostings: { company: Company; raw: RawPosting }[] = [];

  await Promise.all(
    toScrape.map((company) =>
      limit(async () => {
        // Skip if last scrape is still within the company's scan interval
        if (company.lastScrapedAt) {
          const intervalMs = (company.scanIntervalDays ?? 1) * 24 * 60 * 60 * 1000;
          if (Date.now() - company.lastScrapedAt.getTime() < intervalMs) return;
        }
        try {
          const raws = await fetchCompanyJobs(company);
          for (const r of raws) laneAPostings.push({ company, raw: r });
          await db.company.update({
            where: { id: company.id },
            data: { lastScrapedAt: new Date(), lastError: null },
          });
          laneAReport.push({ companyId: company.id, name: company.name, ok: true, newCount: raws.length });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await db.company.update({
            where: { id: company.id },
            data: { lastScrapedAt: new Date(), lastError: msg },
          });
          laneAReport.push({ companyId: company.id, name: company.name, ok: false, newCount: 0, error: msg });
        }
      }),
    ),
  );

  // --- Lane B: aggregators ---
  let laneBPostings: AggregatorPosting[] = [];
  let laneBError: string | undefined;
  try {
    laneBPostings = await fetchAggregatorPostings(preferences);
  } catch (e) {
    laneBError = e instanceof Error ? e.message : String(e);
  }

  // --- Dedupe and persist ---
  const seenKeys = new Set<string>();
  const toCreate: { companyId: string; raw: RawPosting; source: JobSource }[] = [];

  // Lane A first (preferred source).
  for (const { company, raw } of laneAPostings) {
    const key = `${normalizeCompanyName(company.name)}::${normalizeJobTitle(raw.title)}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    toCreate.push({ companyId: company.id, raw, source: "favorite_scrape" });
  }

  // Then Lane B — auto-creating Company rows for non-favorite hits.
  for (const agg of laneBPostings) {
    const key = `${normalizeCompanyName(agg.companyNameRaw)}::${normalizeJobTitle(agg.title)}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const company = await getOrCreateCompany(agg.companyNameRaw);
    toCreate.push({ companyId: company.id, raw: stripAggregatorFields(agg), source: agg.source });
  }

  // Filter to truly NEW postings (not already in DB) and create them.
  let totalNew = 0;
  for (const item of toCreate) {
    const existing = await db.jobPosting.findFirst({
      where: {
        companyId: item.companyId,
        externalId: item.raw.externalId,
        source: item.source,
      },
    });
    if (existing) continue;
    await db.jobPosting.create({
      data: {
        companyId: item.companyId,
        externalId: item.raw.externalId,
        title: item.raw.title,
        normalizedTitle: normalizeJobTitle(item.raw.title),
        location: item.raw.location,
        remote: item.raw.remote,
        salaryText: item.raw.salaryText,
        salaryMin: item.raw.salaryMin,
        salaryMax: item.raw.salaryMax,
        salaryCurrency: item.raw.salaryCurrency,
        url: item.raw.url,
        descriptionMd: item.raw.descriptionMd,
        postedAt: item.raw.postedAt,
        source: item.source,
      },
    });
    totalNew++;
  }

  // --- Fit scoring ---
  // Only score postings that would actually appear on the dashboard. Scoring
  // filtered-out roles (e.g. the thousands of engineer postings from big
  // favorites) wastes Claude spend since the exclude-list hides them anyway.
  // Pull a recency-ordered window, keep the dashboard-eligible ones, and
  // score up to FIT_SCORE_CAP. Newest first so fresh roles score promptly.
  const unscoredWindow = await db.jobPosting.findMany({
    where: { assessment: null, status: { in: ["new", "reviewed", "selected", "applied"] } },
    include: { company: true },
    orderBy: { firstSeenAt: "desc" },
    take: 1500,
  });
  const eligibleUnscored = unscoredWindow.filter((p) =>
    filterPosting({
      title: p.title,
      location: p.location,
      remote: p.remote,
      salaryMax: p.salaryMax,
      source: p.source,
    }).keep,
  );
  const unscored = eligibleUnscored.slice(0, FIT_SCORE_CAP);
  const fitLimit = pLimit(3);
  let totalScored = 0;
  await Promise.all(
    unscored.map((p) =>
      fitLimit(async () => {
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
          totalScored++;
        } catch (e) {
          console.error("[fit-score]", p.id, e);
        }
      }),
    ),
  );

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    laneAFavorites: laneAReport,
    laneBAggregators: { newCount: laneBPostings.length, error: laneBError },
    totalNew,
    totalScored,
    unscoredEligibleRemaining: Math.max(0, eligibleUnscored.length - unscored.length),
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
      active: false, // we won't scrape this one in Lane A
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
