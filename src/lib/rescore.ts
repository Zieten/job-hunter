import pLimit from "p-limit";
import { db } from "@/lib/db";
import { scoreFit } from "@/lib/ai/fit";
import { buildProfileBlob, readPreferences } from "@/lib/profile-blob";
import { filterPosting } from "@/lib/profile-hardcoded";
import type { Prisma } from "@prisma/client";

// Cap to avoid runaway Claude spend if the DB grows. ~300 postings at
// ~$0.01 each ≈ $3 per rescore. Adjust if you outgrow it.
const RESCORE_LIMIT = 300;
const SCORE_CONCURRENCY = 3;

export type RescoreReport = {
  deleted: number;
  candidates: number;
  scored: number;
  failed: number;
};

// Wipes every cached FitAssessment and re-scores all postings that would
// show on the dashboard (filterPosting passes). Used after editing the
// hardcoded prompt or criteria so fit scores reflect the new guidance.
export async function runRescore(userId: string): Promise<RescoreReport> {
  const profile = await db.profile.findUnique({ where: { userId } });
  const preferences = readPreferences(profile);
  const profileBlob = buildProfileBlob(profile);

  // 1. Nuke existing assessments
  const del = await db.fitAssessment.deleteMany({});

  // 2. Pull candidates worth scoring (cap + dashboard-eligible).
  const all = await db.jobPosting.findMany({
    where: { status: { in: ["new", "reviewed", "selected", "applied"] } },
    include: { company: true },
    orderBy: { firstSeenAt: "desc" },
    take: RESCORE_LIMIT,
  });

  const candidates = all.filter((p) =>
    filterPosting({
      title: p.title,
      location: p.location,
      remote: p.remote,
      salaryMax: p.salaryMax,
      source: p.source,
    }).keep,
  );

  // 3. Score in parallel batches.
  const limit = pLimit(SCORE_CONCURRENCY);
  let scored = 0;
  let failed = 0;
  await Promise.all(
    candidates.map((p) =>
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
          console.error("[rescore]", p.id, e);
          failed++;
        }
      }),
    ),
  );

  return { deleted: del.count, candidates: candidates.length, scored, failed };
}
