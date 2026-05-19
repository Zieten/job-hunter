"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/TagInput";
import { Loader2, Upload, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Preferences } from "@/lib/types";

const STEPS = ["Profile", "Companies", "Criteria"] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [hasLinkedin, setHasLinkedin] = useState(false);
  const [hasCV, setHasCV] = useState(false);

  const [bulkCompanies, setBulkCompanies] = useState("");
  const [companiesAdded, setCompaniesAdded] = useState(0);

  const [prefs, setPrefs] = useState<Preferences>({});

  async function uploadFile(field: "linkedin" | "cv", file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append(field, file);
      const res = await fetch("/api/profile/import", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (field === "linkedin") setHasLinkedin(true);
      else setHasCV(true);
      toast.success(`${field === "linkedin" ? "LinkedIn" : "CV"} imported`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function addCompanies() {
    const names = bulkCompanies.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    setBusy(true);
    let ok = 0;
    for (const n of names) {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      if (res.ok) ok++;
    }
    setCompaniesAdded(ok);
    setBusy(false);
    toast.success(`Added ${ok} of ${names.length} companies`);
  }

  async function savePrefs() {
    setBusy(true);
    const form = new FormData();
    form.append("preferences", JSON.stringify(prefs));
    const res = await fetch("/api/profile/import", { method: "POST", body: form });
    setBusy(false);
    if (res.ok) {
      toast.success("All set");
      router.push("/");
    } else toast.error("Failed to save");
  }

  return (
    <div>
      {/* Progress */}
      <ol className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`size-7 rounded-full flex items-center justify-center text-xs font-bold ${
                i < step ? "bg-score-strong text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <CheckCircle2 className="size-4" /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? "font-semibold" : "text-muted-foreground"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl border bg-card p-6 space-y-4"
        >
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold mb-1">Tell us about you</h2>
                <p className="text-sm text-muted-foreground">
                  Upload your LinkedIn data export and current CV. Both are optional — but you'll get much better fit
                  scores and tailored CVs with at least one.
                </p>
              </div>
              <UploadRow
                label="LinkedIn data export (.zip)"
                hint="LinkedIn → Settings → Data Privacy → Get a copy of your data"
                done={hasLinkedin}
                accept=".zip"
                onFile={(f) => uploadFile("linkedin", f)}
                disabled={busy}
              />
              <UploadRow
                label="Current CV (PDF or DOCX)"
                hint="We'll parse the text to seed your structured profile"
                done={hasCV}
                accept=".pdf,.docx"
                onFile={(f) => uploadFile("cv", f)}
                disabled={busy}
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-1">Favorite companies</h2>
                <p className="text-sm text-muted-foreground">
                  Paste 15–20 names — one per line or comma-separated. We'll auto-discover each careers page.
                </p>
              </div>
              <textarea
                value={bulkCompanies}
                onChange={(e) => setBulkCompanies(e.target.value)}
                rows={10}
                placeholder={"Anthropic\nOpenAI\nStripe\nNotion\nFigma"}
                className="w-full rounded-md border bg-background p-3 text-sm font-mono"
              />
              <Button onClick={addCompanies} disabled={busy || !bulkCompanies.trim()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} Add all
              </Button>
              {companiesAdded > 0 && (
                <p className="text-sm text-score-strong flex items-center gap-1">
                  <CheckCircle2 className="size-4" /> Added {companiesAdded} companies
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-1">Search criteria</h2>
                <p className="text-sm text-muted-foreground">For the broad LinkedIn/Indeed/Adzuna scan AND fit scoring.</p>
              </div>
              <Field label="Role keywords">
                <TagInput
                  value={prefs.roleKeywords ?? []}
                  onChange={(v) => setPrefs((p) => ({ ...p, roleKeywords: v }))}
                  placeholder="Type a role, press Enter…"
                />
              </Field>
              <Field label="Locations">
                <TagInput
                  value={prefs.locations ?? []}
                  onChange={(v) => setPrefs((p) => ({ ...p, locations: v }))}
                  placeholder="Seattle, Remote US, …"
                />
              </Field>
              <div className="flex items-center gap-2">
                <input
                  id="remote"
                  type="checkbox"
                  checked={!!prefs.remote}
                  onChange={(e) => setPrefs((p) => ({ ...p, remote: e.target.checked }))}
                  className="size-4"
                />
                <label htmlFor="remote" className="text-sm">Open to remote</label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Salary min">
                  <Input
                    type="number"
                    value={prefs.salaryMin ?? ""}
                    onChange={(e) => setPrefs((p) => ({ ...p, salaryMin: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </Field>
                <Field label="Salary max">
                  <Input
                    type="number"
                    value={prefs.salaryMax ?? ""}
                    onChange={(e) => setPrefs((p) => ({ ...p, salaryMax: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </Field>
                <Field label="Currency">
                  <Input
                    value={prefs.currency ?? ""}
                    onChange={(e) => setPrefs((p) => ({ ...p, currency: e.target.value }))}
                    placeholder="USD"
                  />
                </Field>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={busy}>
                Continue <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={savePrefs} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Finish
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function csv(s: string) {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function UploadRow({
  label,
  hint,
  done,
  accept,
  onFile,
  disabled,
}: {
  label: string;
  hint: string;
  done: boolean;
  accept: string;
  onFile: (f: File) => void;
  disabled: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 flex items-center gap-3 ${done ? "border-score-strong bg-score-strong/5" : ""}`}>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {done ? (
        <span className="text-sm text-score-strong inline-flex items-center gap-1">
          <CheckCircle2 className="size-4" /> Imported
        </span>
      ) : (
        <label className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline cursor-pointer">
          <Upload className="size-4" /> Choose file
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            disabled={disabled}
          />
        </label>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
