import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { JobCard } from "@/components/JobCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { ScanControls } from "@/components/ScanControls";
import { Inbox, Sparkles } from "lucide-react";
import Link from "next/link";
import { DASHBOARD, filterPosting, isGermanSource, SOFT_PREFERENCES } from "@/lib/profile-hardcoded";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await db.profile.findUnique({ where: { userId: session.user.id } });
  if (!profile) redirect("/onboarding");

  // Hardcoded filter (see src/lib/profile-hardcoded.ts) — no longer reads
  // preferences from the DB. DB query stays broad; precision happens in JS.
  const jobsRaw = await db.jobPosting.findMany({
    where: { status: { in: ["new", "reviewed", "selected", "applied"] } },
    include: { company: true, assessment: true },
    take: 1000,
  });

  const jobs = jobsRaw
    .filter((j) => {
      const decision = filterPosting({
        title: j.title,
        location: j.location,
        remote: j.remote,
        salaryMax: j.salaryMax,
        source: j.source,
      });
      if (!decision.keep) return false;

      if (j.assessment !== null) {
        // German firms get a +15 boost when measured against the cutoff.
        const boost = isGermanSource(j.source) ? SOFT_PREFERENCES.germanFirm.fitScoreBoost : 0;
        return j.assessment.fitScore + boost >= DASHBOARD.fitScoreCutoff;
      }
      // Unscored: title-function check is already part of filterPosting above.
      return true;
    })
    .sort((a, b) => {
      // Applied jobs always sink to the bottom
      const aApplied = a.status === "applied";
      const bApplied = b.status === "applied";
      if (aApplied !== bApplied) return aApplied ? 1 : -1;
      // 1. Priority companies first
      if (a.company.isFavorite !== b.company.isFavorite) return a.company.isFavorite ? -1 : 1;
      // 2. Fit score descending (unscored treated as -1)
      const aScore = a.assessment?.fitScore ?? -1;
      const bScore = b.assessment?.fitScore ?? -1;
      if (bScore !== aScore) return bScore - aScore;
      // 3. Recency
      return new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime();
    })
    .slice(0, 100);

  const newCount = jobs.filter((j) => j.status === "new").length;
  const highFit = jobs.filter((j) => (j.assessment?.fitScore ?? 0) >= 80).length;
  const selected = jobs.filter((j) => j.status === "selected").length;

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Today's matches</h1>
          <p className="text-muted-foreground mt-1">Trigger a scan whenever you want fresh postings.</p>
        </div>
        <ScanControls />
      </div>

      <div className="flex gap-2 flex-wrap">
        <Stat label="New" value={newCount} />
        <Stat label="High fit ≥80" value={highFit} />
        <Stat label="Selected" value={selected} />
        <Stat label="Total" value={jobs.length} />
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-7" />}
          title="No postings yet"
          description="No matching roles yet. Add favorite companies, then trigger a scan. Jobs scored below 60 are hidden (+15 boost applies to German firms)."
          action={
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/companies"><Sparkles className="size-4" /> Add companies</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/search-criteria">Set criteria</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium flex items-center gap-1.5">
      <span className="tabular-nums text-base font-bold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
