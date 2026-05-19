"use client";
import { useState } from "react";
import type { Company } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, X, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { toast } from "sonner";

export function CompaniesUI({ initial, growth: initialGrowth = [] }: { initial: Company[]; growth?: Company[] }) {
  const [companies, setCompanies] = useState(initial);
  const [growth, setGrowth] = useState(initialGrowth);
  const [name, setName] = useState("");
  const [careersUrl, setCareersUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState("");
  const [redetecting, setRedetecting] = useState<string | null>(null);

  async function add(n: string, url?: string) {
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n, careersUrl: url }),
    });
    if (!res.ok) {
      toast.error(`Failed to add ${n}`);
      return null;
    }
    const data = (await res.json()) as { company: Company };
    return data.company;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const c = await add(name.trim(), careersUrl.trim() || undefined);
    if (c) {
      setCompanies((prev) => [...prev.filter((p) => p.id !== c.id), c].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setCareersUrl("");
      toast.success(`Added ${c.name} (${c.atsType})`);
    }
    setBusy(false);
  }

  async function handleBulk() {
    const names = bulk.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    setBusy(true);
    let added = 0;
    for (const n of names) {
      const c = await add(n);
      if (c) {
        setCompanies((prev) => [...prev.filter((p) => p.id !== c.id), c].sort((a, b) => a.name.localeCompare(b.name)));
        added++;
      }
    }
    setBulk("");
    setBusy(false);
    toast.success(`Added ${added} of ${names.length}`);
  }

  async function redetect(id: string, name: string) {
    setRedetecting(id);
    const res = await fetch("/api/companies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      const data = (await res.json()) as { company: Company };
      setCompanies((prev) => prev.map((c) => (c.id === id ? data.company : c)));
      toast.success(`${name}: detected as ${data.company.atsType}`);
    } else {
      toast.error(`Re-detect failed for ${name}`);
    }
    setRedetecting(null);
  }

  async function remove(id: string) {
    const res = await fetch("/api/companies", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      setGrowth((prev) => prev.filter((c) => c.id !== id));
      toast.success("Removed");
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
        <Input placeholder="Company name (e.g. Anthropic)" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input placeholder="Careers URL (optional)" value={careersUrl} onChange={(e) => setCareersUrl(e.target.value)} />
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add
        </Button>
      </form>

      <details className="rounded-lg border bg-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Add many at once</summary>
        <div className="p-4 pt-0 space-y-2">
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder="Paste company names, one per line or comma-separated"
            rows={6}
            className="w-full rounded-md border bg-background p-2 text-sm font-mono"
          />
          <Button type="button" onClick={handleBulk} disabled={busy || !bulk.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add all
          </Button>
        </div>
      </details>

      <div className="grid gap-2">
        {companies.length === 0 && (
          <p className="text-sm text-muted-foreground">No companies yet. Add 15–20 favorites above.</p>
        )}
        {companies.map((c) => (
          <div key={c.id} className="rounded-xl border bg-card p-4 flex items-center gap-4">
            <CompanyLogo name={c.name} careersUrl={c.careersUrl} size={36} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium truncate">{c.name}</h3>
                {c.atsType !== "unknown" ? (
                  <Badge variant="secondary" className="text-[10px]">{c.atsType}</Badge>
                ) : (
                  <Badge variant="weak" className="text-[10px]">no ATS detected</Badge>
                )}
                {c.fundingStage && (
                  <Badge className="text-[10px] px-1.5 bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                    {c.fundingStage}
                  </Badge>
                )}
              </div>
              {c.careersUrl ? (
                <a href={c.careersUrl} target="_blank" rel="noopener" className="text-xs text-muted-foreground hover:underline truncate block">
                  {c.careersUrl}
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">No careers URL discovered</span>
              )}
              {c.lastError && (
                <p className="text-xs text-score-weak mt-1 flex items-center gap-1">
                  <AlertCircle className="size-3" /> {c.lastError}
                </p>
              )}
              {c.lastScrapedAt && !c.lastError && (
                <p className="text-xs text-score-strong mt-1 flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Last scanned {new Date(c.lastScrapedAt).toLocaleString()}
                </p>
              )}
            </div>
            {c.lastError && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => redetect(c.id, c.name)}
                disabled={redetecting === c.id}
                aria-label="Re-detect ATS"
                title="Re-detect ATS"
              >
                {redetecting === c.id
                  ? <Loader2 className="size-4 animate-spin" />
                  : <RefreshCw className="size-4" />}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => remove(c.id)} aria-label="Remove">
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      {growth.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Growth-stage companies</h2>
            <p className="text-xs text-muted-foreground">Auto-discovered weekly. Scanned every 14 days.</p>
          </div>
          <div className="grid gap-2">
            {growth.map((c) => (
              <div key={c.id} className="rounded-xl border bg-card p-4 flex items-center gap-4">
                <CompanyLogo name={c.name} careersUrl={c.careersUrl} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium truncate">{c.name}</h3>
                    {c.fundingStage && (
                      <Badge className="text-[10px] px-1.5 bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                        {c.fundingStage}
                      </Badge>
                    )}
                    {c.atsType !== "unknown" ? (
                      <Badge variant="secondary" className="text-[10px]">{c.atsType}</Badge>
                    ) : (
                      <Badge variant="weak" className="text-[10px]">no ATS detected</Badge>
                    )}
                  </div>
                  {c.careersUrl ? (
                    <a href={c.careersUrl} target="_blank" rel="noopener" className="text-xs text-muted-foreground hover:underline truncate block">
                      {c.careersUrl}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">No careers URL discovered</span>
                  )}
                  {c.lastScrapedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last scanned {new Date(c.lastScrapedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(c.id)} aria-label="Remove">
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
