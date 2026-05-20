"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, Telescope, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ScanReport = {
  totalNew: number;
  totalScored: number;
  unscoredEligibleRemaining: number;
  laneAFavorites: { ok: boolean; newCount: number }[];
  laneBAggregators: { newCount: number; error?: string };
};

type DiscoveryReport = {
  discovered: number;
  added: number;
  updated: number;
  skipped: number;
};

type RescoreReport = {
  deleted: number;
  candidates: number;
  scored: number;
  failed: number;
};

export function ScanControls() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const busy = scanning || discovering || rescoring;

  async function runScan() {
    if (scanning) return;
    setScanning(true);
    const t = toast.loading("Scanning ATS pages and aggregators…");
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      const r = data as ScanReport;
      const laneA = r.laneAFavorites.reduce((s, x) => s + (x.newCount ?? 0), 0);
      const laneB = r.laneBAggregators.newCount;
      const remaining =
        r.unscoredEligibleRemaining > 0
          ? ` · ${r.unscoredEligibleRemaining} eligible roles still need scoring — run scan again`
          : "";
      const desc =
        `Lane A (favorites): ${laneA} · Lane B (aggregators): ${laneB}` +
        `${r.laneBAggregators.error ? ` · Lane B error: ${r.laneBAggregators.error}` : ""}` +
        remaining;
      toast.success(`Scan complete — ${r.totalNew} new, ${r.totalScored} scored`, {
        id: t,
        description: desc,
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
    if (rescoring) return;
    const ok = window.confirm(
      "Re-score all postings?\n\nThis deletes every cached fit score and runs Claude against the current hardcoded criteria. Can take a couple minutes and costs roughly $1–3 in API spend.",
    );
    if (!ok) return;
    setRescoring(true);
    const t = toast.loading("Wiping fit scores and re-scoring against current criteria…");
    try {
      const res = await fetch("/api/rescore", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Rescore failed");
      const r = data as RescoreReport;
      toast.success(`Rescore complete — ${r.scored} scored`, {
        id: t,
        description: `Deleted ${r.deleted} old scores · ${r.candidates} eligible · ${r.failed} failed`,
        duration: 8000,
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
