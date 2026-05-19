import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { db } from "@/lib/db";
import { discoverGrowthCompanies } from "@/lib/aggregators/growth-discovery";
import { discoverCareersPage } from "@/lib/ats/detect";
import { normalizeCompanyName } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

// Cap how many new companies we create per weekly run to avoid flooding the DB.
const DISCOVERY_LIMIT = 40;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  if (!force && auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const discovered = await discoverGrowthCompanies();
  const limit = pLimit(5);
  let added = 0;
  let updated = 0;
  let skipped = 0;

  const tasks = discovered.slice(0, DISCOVERY_LIMIT).map(({ companyName, fundingStage }) =>
    limit(async () => {
      const normalizedName = normalizeCompanyName(companyName);
      const existing = await db.company.findUnique({ where: { normalizedName } });

      if (existing) {
        // Backfill fundingStage if it wasn't set before
        if (!existing.fundingStage) {
          await db.company.update({ where: { id: existing.id }, data: { fundingStage } });
          updated++;
        } else {
          skipped++;
        }
        return;
      }

      const atsResult = await discoverCareersPage(companyName).catch(() => null);

      await db.company.create({
        data: {
          name: companyName,
          normalizedName,
          careersUrl: atsResult?.url ?? null,
          atsType: atsResult?.detection.type ?? "unknown",
          atsSlug: atsResult?.detection.slug ?? null,
          atsTenant: atsResult?.detection.tenant ?? null,
          atsHost: atsResult?.detection.host ?? null,
          atsSite: atsResult?.detection.site ?? null,
          isFavorite: false,
          active: true,
          scanIntervalDays: 14,
          fundingStage,
        },
      });
      added++;
    }),
  );

  await Promise.all(tasks);

  return NextResponse.json({
    discovered: discovered.length,
    added,
    updated,
    skipped,
  });
}
