"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, Telescope, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type DiscoveryReport = {
  discovered: number;
  added: number;
  updated: number;
  skipped: number;
};

type ScanPhaseResult = {
  newCount?: number;
  scraped?: number;
  scored?: number;
  remaining?: number;
  error?: string;
};

// Per-click wall-clock budget for the score loop. A first big scan can leave a
// few hundred eligible roles to score; this caps one button press to a sane
// duration. Re-click to continue — scored progress persists in the DB.
const SCORE_BUDGET_MS = 8 * 60 * 1000;
const FETCH_MAX_ITERS = 40;
const SCORE_MAX_ITERS = 80;

export function ScanControls() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const busy = scanning || discovering || rescoring;

  // One bounded /api/scan call. Each phase finishes inside the 60s limit.
  async function callScan(mode: "aggregators" | "fetch" | "score"): Promise<ScanPhaseResult> {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `Scan (${mode}) failed`);
    return data as ScanPhaseResult;
  }

  // Loop score batches until the backlog clears or the time budget is hit.
  // Returns [scoredThisRun, remaining].
  async function scoreLoop(t: string | number, label: string): Promise<[number, number]> {
    let scored = 0;
    let remaining = 0;
    const deadline = Date.now() + SCORE_BUDGET_MS;
    for (let i = 0; i < SCORE_MAX_ITERS; i++) {
      const r = await callScan("score");
      scored += r.scored ?? 0;
      remaining = r.remaining ?? 0;
      toast.loading(`${label} ${scored} scored · ${remaining} left…`, { id: t });
      if (remaining <= 0) break;
      if ((r.scored ?? 0) === 0) break; // persistent failures — stop looping
      if (Date.now() > deadline) break;
    }
    return [scored, remaining];
  }

  async function runScan() {
    if (busy) return;
    setScanning(true);
    const t = toast.loading("Searching job boards…");
    try {
      let totalNew = 0;

      // Phase 1 — aggregators (Lane B), one call.
      const agg = await callScan("aggregators");
      totalNew += agg.newCount ?? 0;

      // Phase 2 — scrape favorite companies in bounded batches.
      for (let i = 0; i < FETCH_MAX_ITERS; i++) {
        const r = await callScan("fetch");
        totalNew += r.newCount ?? 0;
        toast.loading(`Scraping companies… ${r.remaining ?? 0} left`, { id: t });
        if ((r.remaining ?? 0) <= 0) break;
      }

      // Phase 3 — score eligible roles within the per-click time budget.
      const [scored, remaining] = await scoreLoop(t, "Scoring matches…");

      const tail = remaining > 0 ? ` · ${remaining} still need scoring — click Run scan again` : "";
      toast.success(`Scan complete — ${totalNew} new, ${scored} scored${tail}`, {
        id: t,
        duration: 9000,
      });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed", { id: t });
    } finally {
      setScanning(false);
    }
  }

  async function runDiscover() {
    if (discovering) return;
    setDiscovering(true);
    const t = toast.loading("Hunting Series C/D companies…");
    try {
      const res = await fetch("/api/discover", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Discovery failed");
      const r = data as DiscoveryReport;
      toast.success(
        `Discovery complete — ${r.added} added, ${r.updated} updated, ${r.skipped} skipped`,
        { id: t },
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Discovery failed", { id: t });
    } finally {
      setDiscovering(false);
    }
  }

  async function runRescore() {
    if (busy) return;
    const ok = window.confirm(
      "Re-score all postings?\n\nThis deletes every cached fit score, then re-scores against the current criteria. Costs roughly $1-3 in API spend and may take several minutes — keep this tab open. Re-click to continue if it does not finish in one pass.",
    );
    if (!ok) return;
    setRescoring(true);
    const t = toast.loading("Wiping fit scores…");
    try {
      const res = await fetch("/api/rescore", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Rescore failed");
      const deleted = (data as { deleted?: number }).deleted ?? 0;

      const [scored, remaining] = await scoreLoop(t, "Re-scoring…");

      const tail = remaining > 0 ? ` · ${remaining} left — click Re-score again` : "";
      toast.success(`Re-score — ${deleted} cleared, ${scored} scored${tail}`, {
        id: t,
        duration: 9000,
      });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rescore failed", { id: t });
    } finally {
      setRescoring(false);
    }
  }

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <CronButton
        onClick={runScan}
        busy={scanning}
        disabled={busy && !scanning}
        label="Run scan"
        busyLabel="Scanning…"
        icon={<Radar className="size-4" />}
        gradient="from-indigo-500 via-violet-500 to-fuchsia-500"
      />
      <CronButton
        onClick={runDiscover}
        busy={discovering}
        disabled={busy && !discovering}
        label="Discover companies"
        busyLabel="Discovering…"
        icon={<Telescope className="size-4" />}
        gradient="from-emerald-500 via-teal-500 to-cyan-500"
      />
      <button
        onClick={runRescore}
        disabled={busy}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
          "border border-border bg-background text-muted-foreground",
          "hover:bg-accent hover:text-foreground transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
        title="Wipe all fit scores and re-score against current criteria"
      >
        {rescoring ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
        {rescoring ? "Re-scoring…" : "Re-score"}
      </button>
    </div>
  );
}

function CronButton({
  onClick,
  busy,
  disabled,
  label,
  busyLabel,
  icon,
  gradient,
}: {
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  label: string;
  busyLabel: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className={cn(
        "group relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white",
        "bg-gradient-to-r shadow-md shadow-black/10",
        "transition-all duration-200",
        "hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-white/60",
        gradient,
      )}
    >
      <span
        className={cn(
          "absolute inset-0 rounded-lg bg-gradient-to-r opacity-0 blur-md transition-opacity duration-300",
          "group-hover:opacity-60",
          gradient,
        )}
        aria-hidden
      />
      <span className="relative flex items-center gap-2">
        {busy ? <Loader2 className="size-4 animate-spin" /> : icon}
        {busy ? busyLabel : label}
      </span>
    </button>
  );
}
