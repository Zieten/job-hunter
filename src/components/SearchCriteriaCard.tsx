import { Target, MapPin, Briefcase, DollarSign, Plane, Globe2, Sparkles, Ban } from "lucide-react";
import { CANDIDATE, HARD_FILTER, SOFT_PREFERENCES, DASHBOARD } from "@/lib/profile-hardcoded";

// Read-only card that surfaces the hardcoded search criteria from
// src/lib/profile-hardcoded.ts. To change anything below, edit that file.
export function SearchCriteriaCard() {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-5">
      <div className="flex items-start gap-2">
        <Target className="size-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold">Search criteria</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hardcoded — these drive the dashboard filter and the AI fit score. Edit{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">src/lib/profile-hardcoded.ts</code> to change.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <Row icon={<MapPin className="size-4" />} label="Location">
          <p>Based in <strong>{CANDIDATE.basedIn}</strong>. Seattle metro or US-remote.</p>
          {HARD_FILTER.northAmericaOkForGermanFirms && (
            <p className="text-muted-foreground text-xs mt-1">For German firms: anywhere in North America.</p>
          )}
        </Row>

        <Row icon={<Briefcase className="size-4" />} label="Target roles">
          <ul className="space-y-0.5">
            <li>Country Manager / Head of US / GM</li>
            <li>Business Development &amp; Partnerships</li>
            <li>Sales leadership <span className="text-muted-foreground">(lower priority)</span></li>
            <li>Growth / GTM leadership</li>
          </ul>
        </Row>

        <Row icon={<Target className="size-4" />} label="Seniority">
          <p>Director, VP, Head of.</p>
          <p className="text-muted-foreground text-xs mt-1">
            Senior Manager only if comp ≥ ${(HARD_FILTER.minTotalCompUsd / 1000).toFixed(0)}k.
          </p>
        </Row>

        <Row icon={<DollarSign className="size-4" />} label="Comp floor">
          <p>
            <strong>${(HARD_FILTER.minTotalCompUsd / 1000).toFixed(0)}k</strong> total (base + bonus).
          </p>
        </Row>

        <Row icon={<Plane className="size-4" />} label="Travel">
          <p>Up to {SOFT_PREFERENCES.acceptableTravelPctMax}% acceptable.</p>
        </Row>

        <Row icon={<Globe2 className="size-4" />} label="Languages">
          <p>English, German{CANDIDATE.speaksGerman ? " (fluent — strength for German firms)" : ""}.</p>
        </Row>
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="flex items-start gap-2">
          <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Preferred verticals (fit boost)</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              AI / ML / GenAI, B2B SaaS, dev tools, cloud infra, security, mobility, climate, energy, industrial, supply chain, product, hardware, venture capital.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Ban className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Deprioritized</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Retail banking, consumer fintech. Not excluded — just penalized in fit scoring.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Ban className="size-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Dealbreaker</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Requires relocation outside Seattle metro.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>German firms get a <strong>+{SOFT_PREFERENCES.germanFirm.fitScoreBoost}</strong> fit boost and bypass strict gates.</span>
        <span>Dashboard cutoff: <strong>{DASHBOARD.fitScoreCutoff}</strong></span>
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">{label}</p>
        {children}
      </div>
    </div>
  );
}
