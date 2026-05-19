"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, Telescope, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ScanReport = {
  totalNew: number;
  totalScored: number;
  laneAFavorites: { ok: boolean; newCount: number }[];
  laneBAggregators: { newCount: number; error?: string };
};

type DiscoveryReport = {
  discovered: number;
  added: number;
  updated: number;
  skipped: number;
};

export function ScanControls() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [discovering, setDiscovering] = useState(false);

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
      const desc = `Lane A (favorites): ${laneA} · Lane B (aggregators): ${laneB}${r.laneBAggregators.error ? ` · Lane B error: ${r.laneBAggregators.error}` : ""}`;
      toast.success(`Scan complete — ${r.totalNew} new, ${r.totalScored} scored`, {
        id: t,
        description: desc,
        duration: 8000,
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

  return (
    <div className="flex gap-2 flex-wrap">
      <CronButton
        onClick={runScan}
        busy={scanning}
        disabled={discovering}
        label="Run scan"
        busyLabel="Scanning…"
        icon={<Radar className="size-4" />}
        gradient="from-indigo-500 via-violet-500 to-fuchsia-500"
      />
      <CronButton
        onClick={runDiscover}
        busy={discovering}
        disabled={scanning}
        label="Discover companies"
        busyLabel="Discovering…"
        icon={<Telescope className="size-4" />}
        gradient="from-emerald-500 via-teal-500 to-cyan-500"
      />
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
