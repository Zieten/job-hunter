"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Clock, Star, CheckCheck, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobPosting, FitAssessment, Company } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/utils";

type Props = {
  job: JobPosting & { company: Company; assessment: FitAssessment | null };
};

function fitTone(fit: number | null): { stripe: string; pill: string } {
  if (fit === null) return { stripe: "bg-muted-foreground/20", pill: "" };
  if (fit >= 80)
    return {
      stripe: "bg-green-500",
      pill: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
    };
  if (fit >= 60)
    return {
      stripe: "bg-amber-500",
      pill: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    };
  return {
    stripe: "bg-red-500/70",
    pill: "bg-red-500/15 text-red-500 border-red-500/30",
  };
}

export function JobCard({ job }: Props) {
  const [applied, setApplied] = useState(job.status === "applied");
  const [busy, setBusy] = useState(false);

  const fit = job.assessment?.fitScore ?? null;
  const tone = fitTone(fit);
  const topStrength = (job.assessment?.strengths as string[] | undefined)?.[0] ?? null;

  const sourceLabel =
    job.source === "favorite_scrape"
      ? "Favorite"
      : job.source === "aggregator_jsearch"
        ? "LinkedIn/Indeed"
        : job.source === "aggregator_german_us"
          ? "DE→US"
          : job.source === "aggregator_indeed_de"
            ? "Indeed DE"
            : "Adzuna";

  async function toggleApplied(e: React.MouseEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const next = applied ? "new" : "applied";
    try {
      await fetch(`/api/jobs/${job.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      setApplied(!applied);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileHover={{ y: -1 }}
      className="h-full"
    >
      <Link href={`/jobs/${job.id}`} className="block h-full">
        <div
          className={cn(
            "relative h-full overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm pl-4 pr-3 py-3 hover:border-primary/40 transition-colors flex flex-col gap-1.5",
            job.company.isFavorite && !applied && "border-amber-400/50 bg-amber-400/[0.03]",
            applied && "opacity-50 border-dashed",
          )}
        >
          <div className={cn("absolute inset-y-0 left-0 w-1", tone.stripe)} aria-hidden />

          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[15px] leading-snug line-clamp-3">
                {job.title}
              </h3>
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                {job.company.isFavorite && (
                  <Star
                    className="size-3 shrink-0 fill-amber-400 text-amber-400"
                    aria-label="Priority company"
                  />
                )}
                {job.company.name}
              </p>
            </div>
            {fit !== null && (
              <span
                className={cn(
                  "shrink-0 inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-xs font-bold tabular-nums",
                  tone.pill,
                )}
              >
                {fit}
              </span>
            )}
          </div>

          {topStrength && (
            <p className="text-[11px] italic text-muted-foreground/80 line-clamp-1">
              ✓ {topStrength}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {job.location && (
              <span className="inline-flex items-center gap-0.5 min-w-0 max-w-full">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{job.location}</span>
              </span>
            )}
            {job.salaryText && (
              <span className="inline-flex items-center gap-0.5 text-foreground/80 font-medium">
                <Banknote className="size-3 shrink-0" />
                <span className="truncate max-w-[140px]">{job.salaryText}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-0.5">
              <Clock className="size-3" />
              {relativeTime(job.postedAt ?? job.firstSeenAt)}
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {sourceLabel}
            </Badge>
            <button
              onClick={toggleApplied}
              disabled={busy}
              className={cn(
                "ml-auto inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                applied
                  ? "border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400"
                  : "border-dashed border-muted-foreground/40 text-muted-foreground hover:border-green-500/50 hover:text-green-600",
              )}
              aria-label={applied ? "Mark not applied" : "Mark applied"}
            >
              <CheckCheck className="size-3" />
              {applied ? "Applied" : "Apply"}
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
