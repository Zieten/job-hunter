// Single source of truth for Ben's job search. Drives the dashboard filter
// and the fit-scoring prompt. Edit values here, not in the DB preferences blob.

import type { JobSource } from "@prisma/client";

export const CANDIDATE = {
  speaksGerman: true,
  basedIn: "Seattle, WA",
  willingToCoverNorthAmericaForDeFirm: true,
} as const;

export const HARD_FILTER = {
  seattleMetroCities: [
    "seattle",
    "bellevue",
    "redmond",
    "kirkland",
    "issaquah",
    "renton",
    "bothell",
    "tacoma",
  ],
  remoteUsOk: true,
  northAmericaOkForGermanFirms: true,

  roleFunctionKeywords: [
    "country manager",
    "head of us",
    "head of north america",
    "general manager us",
    "gm us",
    "us general manager",
    "vp us",
    "vp north america",
    "vp americas",
    "business development",
    "head of partnerships",
    "strategic partnerships",
    "vp sales",
    "head of sales",
    "director of sales",
    "director sales",
    "head of growth",
    "vp growth",
    "director of growth",
    "gtm lead",
    "head of gtm",
    "go-to-market",
  ],

  seniorityKeywords: [
    "director",
    "head of",
    "vp",
    "vice president",
    "chief",
    "cro",
    "founding",
    "general manager",
  ],
  seniorManagerKeywords: ["senior manager", "sr manager", "sr. manager"],

  minTotalCompUsd: 250_000,

  rejectIfRequiresRelocationOutsideSeattle: true,
} as const;

export const SOFT_PREFERENCES = {
  preferredVerticals: [
    "ai",
    "ml",
    "machine learning",
    "genai",
    "llm",
    "b2b saas",
    "developer tools",
    "devtools",
    "cloud",
    "infrastructure",
    "security",
    "mobility",
    "ev",
    "climate",
    "energy",
    "industrial",
    "supply chain",
    "product",
    "hardware",
    "venture capital",
    "vc",
  ],
  deprioritizedVerticals: ["retail banking", "consumer fintech"],

  germanFirm: {
    bypassRoleAndSeniorityFilter: true,
    bypassCompFloor: true,
    fitScoreBoost: 15,
  },

  acceptableTravelPctMax: 50,
} as const;

export const DASHBOARD = {
  fitScoreCutoff: 60,
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Helpers used by the dashboard filter and the fit-scoring prompt.
// ────────────────────────────────────────────────────────────────────────────

const GERMAN_SOURCES: JobSource[] = ["aggregator_german_us", "aggregator_indeed_de"];

export function isGermanSource(source: JobSource): boolean {
  return GERMAN_SOURCES.includes(source);
}

export function locationPasses(
  location: string | null,
  remote: boolean,
  source: JobSource,
): boolean {
  if (HARD_FILTER.remoteUsOk && remote) return true;

  const loc = (location ?? "").toLowerCase();
  if (!loc) return true; // unknown — let it through, fit scoring will weigh in

  // Seattle metro substring match
  if (HARD_FILTER.seattleMetroCities.some((c) => loc.includes(c))) return true;

  // German firms: anywhere in North America is acceptable
  if (HARD_FILTER.northAmericaOkForGermanFirms && isGermanSource(source)) {
    const naHints = ["united states", "u.s.", "usa", "canada", "remote"];
    if (naHints.some((h) => loc.includes(h))) return true;
    // Conservative US state suffix check (covers ", CA", ", NY", etc.)
    if (/,\s*[a-z]{2}\b/.test(loc)) return true;
  }

  // US-remote phrasing
  if (HARD_FILTER.remoteUsOk && /remote.*(us|u\.s\.|united states)/.test(loc)) return true;

  return false;
}

export function titleMatchesRoleFunction(title: string): boolean {
  const t = title.toLowerCase();
  return HARD_FILTER.roleFunctionKeywords.some((k) => t.includes(k));
}

export function titleMeetsSeniority(title: string, salaryMax: number | null): boolean {
  const t = title.toLowerCase();
  if (HARD_FILTER.seniorityKeywords.some((k) => t.includes(k))) return true;

  // Senior Manager allowed if comp meets floor (comp check is best-effort —
  // many postings don't publish, and those fall back to fit-scoring judgment).
  if (HARD_FILTER.seniorManagerKeywords.some((k) => t.includes(k))) {
    if (salaryMax === null) return true; // unknown salary — let fit scoring decide
    return salaryMax >= HARD_FILTER.minTotalCompUsd;
  }

  return false;
}

export function compPasses(salaryMax: number | null): boolean {
  if (salaryMax === null) return true; // unknown — fit scoring weighs in
  return salaryMax >= HARD_FILTER.minTotalCompUsd;
}

export type FilterDecision = { keep: boolean; reason?: string };

export function filterPosting(p: {
  title: string;
  location: string | null;
  remote: boolean;
  salaryMax: number | null;
  source: JobSource;
}): FilterDecision {
  // German-firm bypass: skip role / seniority / comp checks, only enforce
  // North-America geography.
  if (isGermanSource(p.source) && SOFT_PREFERENCES.germanFirm.bypassRoleAndSeniorityFilter) {
    if (!locationPasses(p.location, p.remote, p.source)) {
      return { keep: false, reason: "outside North America" };
    }
    return { keep: true };
  }

  if (!locationPasses(p.location, p.remote, p.source)) {
    return { keep: false, reason: "location outside Seattle metro / remote-US" };
  }
  if (!titleMatchesRoleFunction(p.title)) {
    return { keep: false, reason: "title doesn't match target role functions" };
  }
  if (!titleMeetsSeniority(p.title, p.salaryMax)) {
    return { keep: false, reason: "below target seniority" };
  }
  if (!compPasses(p.salaryMax)) {
    return { keep: false, reason: "below comp floor" };
  }
  return { keep: true };
}

// Prompt fragment injected into fit-scoring system message. Keep it concise —
// it sits inside the cached system block so it costs once across the batch.
export const HARDCODED_PREFS_PROMPT = `
HARDCODED CANDIDATE PROFILE (authoritative — overrides any conflicting profile blob):
- Based in Seattle, WA. Will not relocate outside Seattle metro.
- Acceptable locations: Seattle metro, US-remote. For German employers, anywhere in North America.
- Target roles: Country Manager / Head of US / GM, Business Development & Partnerships, Sales leadership (lower priority), Growth / GTM leadership.
- Target seniority: Director, VP / Head of. Senior Manager OK only if total comp >= $250k.
- Minimum total comp (base + bonus, ignoring equity): $250,000.
- Acceptable travel: up to 50%.
- Speaks fluent German — weight this as a strength for any German firm, German JD, or German-counterparty role.
- PREFERRED verticals (boost): AI/ML/GenAI, B2B SaaS / dev tools / cloud infra / security, mobility / climate / energy / industrial / supply chain, product, hardware, venture capital.
- DEPRIORITIZED verticals (slight penalty, not exclusion): retail banking, consumer fintech.
- GERMAN-firm postings (sources aggregator_german_us, aggregator_indeed_de): apply a +15 fit boost AND ignore the strict role/seniority/comp filters (comp is often non-public for first-US-hire roles).
- Hard dealbreaker: requires relocation outside Seattle metro.
`.trim();