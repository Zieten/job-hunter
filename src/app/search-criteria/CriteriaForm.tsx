"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/TagInput";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { SENIORITY_LEVELS, type Preferences, type SeniorityLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CriteriaForm({ initial }: { initial: Preferences }) {
  const [prefs, setPrefs] = useState<Preferences>(initial);
  const [busy, setBusy] = useState(false);

  function update<K extends keyof Preferences>(k: K, v: Preferences[K]) {
    setPrefs((p) => ({ ...p, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData();
    form.append("preferences", JSON.stringify(prefs));
    const res = await fetch("/api/profile/import", { method: "POST", body: form });
    setBusy(false);
    if (res.ok) toast.success("Saved");
    else toast.error("Failed to save");
  }

  return (
    <form onSubmit={save} className="space-y-5 max-w-2xl">
      <Field label="Role keywords" hint="Press Enter or comma to add each keyword as a chip">
        <TagInput
          value={prefs.roleKeywords ?? []}
          onChange={(v) => update("roleKeywords", v)}
          placeholder="product manager, AI PM"
        />
      </Field>

      <Field label="Locations" hint="Cities, regions, or countries — one chip each">
        <TagInput
          value={prefs.locations ?? []}
          onChange={(v) => update("locations", v)}
          placeholder="San Francisco Bay Area, Remote US"
        />
      </Field>

      <div className="flex items-center gap-2">
        <input
          id="remote"
          type="checkbox"
          checked={!!prefs.remote}
          onChange={(e) => update("remote", e.target.checked)}
          className="size-4"
        />
        <label htmlFor="remote" className="text-sm">Open to fully-remote roles</label>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Salary min">
          <Input
            type="number"
            value={prefs.salaryMin ?? ""}
            onChange={(e) => update("salaryMin", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="150000"
          />
        </Field>
        <Field label="Salary max">
          <Input
            type="number"
            value={prefs.salaryMax ?? ""}
            onChange={(e) => update("salaryMax", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="250000"
          />
        </Field>
        <Field label="Currency">
          <Input
            value={prefs.currency ?? ""}
            onChange={(e) => update("currency", e.target.value)}
            placeholder="USD"
          />
        </Field>
      </div>

      <Field label="Seniority" hint="Select one or more — leave empty for any">
        <div className="flex flex-wrap gap-2">
          {SENIORITY_LEVELS.map((s) => {
            const selected = (prefs.seniority ?? []).includes(s.value);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  const current = prefs.seniority ?? [];
                  const next: SeniorityLevel[] = selected
                    ? current.filter((v) => v !== s.value)
                    : [...current, s.value];
                  update("seniority", next.length ? next : undefined);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm border transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Must-haves" hint="e.g. equity, learning budget, hybrid 2-3 days">
        <TagInput
          value={prefs.mustHaves ?? []}
          onChange={(v) => update("mustHaves", v)}
        />
      </Field>

      <Field label="Dealbreakers" hint="e.g. 5-day RTO, no remote, on-call rotations">
        <TagInput
          value={prefs.dealbreakers ?? []}
          onChange={(v) => update("dealbreakers", v)}
        />
      </Field>

      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save criteria
      </Button>
    </form>
  );
}

function csv(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
