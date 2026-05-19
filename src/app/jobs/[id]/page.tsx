import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CompanyLogo } from "@/components/CompanyLogo";
import { FitRing } from "@/components/FitRing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Banknote, ExternalLink } from "lucide-react";
import { relativeTime } from "@/lib/utils";
import { TailorPanel } from "./TailorPanel";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const job = await db.jobPosting.findUnique({
    where: { id },
    include: { company: true, assessment: true, tailoredCVs: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!job) notFound();

  const fit = job.assessment?.fitScore ?? 0;
  const fitVariant = fit >= 80 ? "strong" : fit >= 60 ? "mid" : "weak";
  const latestCV = job.tailoredCVs[0] ?? null;

  return (
    <div className="py-6 space-y-6">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">← Back</Link>

      <div className="flex items-start gap-4">
        <CompanyLogo name={job.company.name} careersUrl={job.company.careersUrl} size={64} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">{job.title}</h1>
          <p className="text-muted-foreground">{job.company.name}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {job.location && (
              <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {job.location}</span>
            )}
            {job.salaryText && (
              <span className="inline-flex items-center gap-1"><Banknote className="size-3" /> {job.salaryText}</span>
            )}
            <span>Posted {relativeTime(job.postedAt ?? job.firstSeenAt)}</span>
          </div>
        </div>
        {job.assessment && (
          <div className="hidden sm:flex flex-col items-center gap-2">
            <FitRing score={fit} size={96} stroke={7} label="fit" />
            <div className="text-xs text-muted-foreground">{job.assessment.interviewProbability}% interview prob.</div>
          </div>
        )}
      </div>

      {job.assessment && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold mb-2 text-score-strong">Strengths</h2>
            <ul className="space-y-1.5 text-sm">
              {(job.assessment.strengths as string[]).map((s, i) => (
                <li key={i}>• {s}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold mb-2 text-score-weak">Gaps</h2>
            <ul className="space-y-1.5 text-sm">
              {(job.assessment.gaps as string[]).map((s, i) => (
                <li key={i}>• {s}</li>
              ))}
            </ul>
          </div>
          {job.assessment.reasoning && (
            <div className="sm:col-span-2 rounded-xl border bg-card p-4">
              <Badge variant={fitVariant} className="mb-2">{fit} fit</Badge>
              <p className="text-sm text-muted-foreground">{job.assessment.reasoning}</p>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold mb-2">Job description</h2>
        <div className="text-sm whitespace-pre-wrap text-foreground/90 max-h-[600px] overflow-y-auto">
          {job.descriptionMd}
        </div>
      </div>

      <TailorPanel jobId={job.id} initialCV={latestCV} applyUrl={job.url} />
    </div>
  );
}
