import { Target, MapPin, Briefcase, DollarSign, Plane, Globe2, Sparkles, Ban, User2, Search } from "lucide-react";
import { CANDIDATE, HARD_FILTER, SOFT_PREFERENCES, DASHBOARD, AGGREGATOR_SEARCH_TERMS } from "@/lib/profile-hardcoded";

// Read-only card that surfaces the hardcoded search criteria from
// src/lib/profile-hardcoded.ts. To change anything below, edit that file.
export function SearchCriteriaCard() {
  const bg = CANDIDATE.background;
  return (
    <div className="rounded-xl border bg-card p-5 space-y-6">
      <div className="flex items-start gap-2">
        <Target className="size-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold">Search criteria & background</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hardcoded — drives the dashboard filter, the aggregator queries, and the AI fit score. Edit{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">src/lib/profile-hardcoded.ts</code> to change.
          </p>
        </div>
      </div>

      {/* Background */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <User2 className="size-4 text-muted-foreground" />
          <h3 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">Who you are</h3>
        </div>
        <div className="text-sm space-y-1">
          <p><strong>{CANDIDATE.name}</strong> · {bg.currentTitle}</p>
          <p className="text-muted-foreground text-xs">
            {bg.yearsExperience}+ years across {bg.currentEmployer} + {bg.priorEmployers.slice(0, 2).join(", ")} · {CANDIDATE.basedIn}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Core strengths</p>
          <ul className="text-sm space-y-0.5 list-disc list-inside text-muted-foreground">
            {bg.coreStrengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="text-xs text-muted-foreground">
          <strong className="text-foreground">Tech alliances:</strong> {bg.technologyAlliances.join(" · ")}
        </div>
      </section>

      <div className="border-t" />

      {/* Target roles (indicators, not exhaustive) */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Briefcase className="size-4 text-muted-foreground" />
          <h3 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">Target roles — indicators (any adjacent role also counts)</h3>
        </div>
        <p className="text-xs text-muted-foreground italic">
          These are signals, not a closed list. The filter only rejects obviously off-target titles (IC engineering, junior, back-office). The AI fit score decides whether anything else is a fit based on skill overlap.
        </p>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li><strong>Strongest:</strong> Partner / Alliance Manager · Partner Success Lead · GSI Partner Lead — at AI / cloud / SaaS vendors</li>
          <li>Head of Ecosystem · Head of Partnerships · VP / Director Partnerships</li>
          <li>Country Manager · Head of US · GM US — especially European / German firms</li>
          <li>Business Development leadership · Strategic Accounts · Enterprise Sales leadership</li>
          <li>Growth / GTM leadership · AI Transformation leadership · Head of AI</li>
          <li><span className="text-muted-foreground">Adjacent: Customer Success VP, Solutions / Pre-sales leadership, Channel programs, Strategic alliances within an industry, Revenue Ops, Founding GTM, Industry GM at a SaaS vendor, etc.</span></li>
        </ol>
      </section>

      <div className="border-t" />

      {/* Filter constraints */}
      <section className="grid sm:grid-cols-2 gap-4 text-sm">
        <Row icon={<MapPin className="size-4" />} label="Location">
          <p>Seattle metro or US-remote.</p>
          {HARD_FILTER.northAmericaOkForGermanFirms && (
            <p className="text-muted-foreground text-xs mt-1">German firms: anywhere in North America.</p>
          )}
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
          <p>German native, English business fluent, Italian intermediate.</p>
        </Row>

        <Row icon={<Search className="size-4" />} label="Aggregator queries">
          <p className="text-muted-foreground text-xs">
            {AGGREGATOR_SEARCH_TERMS.slice(0, 4).join(" · ")} …{" "}
            <span className="opacity-60">+{AGGREGATOR_SEARCH_TERMS.length - 4} more</span>
          </p>
        </Row>
      </section>

      <div className="border-t" />

      {/* Verticals & dealbreakers */}
      <section className="space-y-3">
        <div className="flex items-start gap-2">
          <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Preferred verticals (fit boost)</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              AI / Agentic / GenAI / LLM · enterprise SaaS · dev tools / cloud infra / data platforms / security ·
              partner ecosystem / alliances / GSI · mobility / climate / energy / industrial / supply chain · sustainability / ESG · hardware · VC.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Ban className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Deprioritized</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Retail banking, consumer fintech, gambling, adult. Not excluded — penalized in fit scoring.
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

        <div className="flex items-start gap-2">
          <Ban className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Title exclusions (auto-rejected)</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              IC engineering (software/data/ML engineer, SRE, etc.), engineering management, design/UX, marketing execution, accounting / finance back-office, HR / recruiting, legal admin, field ops, junior / intern / associate levels.
            </p>
          </div>
        </div>
      </section>

      <div className="border-t pt-3 flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
        <span>German firms: <strong>+{SOFT_PREFERENCES.germanFirm.fitScoreBoost}</strong> fit boost · bypass strict gates.</span>
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
