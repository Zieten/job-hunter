// Single source of truth for Ben's job search. Drives the dashboard filter
// and the fit-scoring prompt. Edit values here, not in the DB preferences blob.

import type { JobSource } from "@prisma/client";

export const CANDIDATE = {
  name: "Ben Reiss",
  speaksGerman: true,
  germanNative: true,
  basedIn: "Seattle, WA",
  willingToCoverNorthAmericaForDeFirm: true,

  // Background signals used by the SearchCriteriaCard and the fit prompt.
  // Source: LinkedIn + CV (Oct 2022 – present at KPMG US; prior EY + KPMG Germany).
  background: {
    yearsExperience: 10,
    currentTitle: "Director — Operational Excellence, AI Transformation & GTM (KPMG x Microsoft)",
    currentEmployer: "KPMG US",
    priorEmployers: ["KPMG Germany", "Ernst & Young", "Secucloud", "Porsche Design Group"],
    education: ["MBA (HAW Hamburg)", "BSc (Hochschule Niederrhein)"],
    notableWins: [
      "FY26: sold $2.5M in AI transformation work directly to Microsoft",
      "Founded EMEA ESG Task Force (35 people, 60+ countries)",
      "Built KPMG US sustainability practice from zero",
    ],
    coreStrengths: [
      "GSI / Big-4 alliance strategy (inside view from both EY and KPMG)",
      "Microsoft ecosystem partner success — QBRs, JBP, co-investment, adoption",
      "Partner Success & Lifecycle Management (adoption, retention, expansion)",
      "Zero-to-one team building and capability programs",
      "Agentic AI / Claude Code (uses Claude Code daily for partner workflows)",
      "Cross-cultural EMEA ↔ US execution; native German",
    ],
    technologyAlliances: ["Microsoft", "SAP", "ServiceNow", "Salesforce", "Anthropic"],
    communityRoles: [
      "Steering Committee — German American Chamber of Commerce & German Consulate, Seattle",
      "Big Brothers Big Sisters of America (Seattle)",
    ],
  },
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
    // Country / GM / regional leadership
    "country manager",
    "head of us",
    "head of north america",
    "general manager us",
    "gm us",
    "us general manager",
    "vp us",
    "vp north america",
    "vp americas",

    // Partner / alliance / ecosystem — Ben's core strength (GSI alliances, partner success)
    "partner manager",
    "partnerships manager",
    "alliance manager",
    "alliances manager",
    "strategic alliances",
    "strategic partnerships",
    "head of partnerships",
    "head of alliances",
    "head of ecosystem",
    "head of partner",
    "vp partnerships",
    "vp alliances",
    "vp ecosystem",
    "vp partner",
    "director of partnerships",
    "director of alliances",
    "director of partner",
    "director, partner",
    "director, partnerships",
    "partner success",
    "partner lead",
    "partner sales",
    "channel sales",
    "channel manager",
    "ecosystem lead",
    "ecosystem manager",
    "gsi lead",
    "gsi partner",
    "global si",
    "global systems integrator",
    "si partnerships",

    // BD / sales / growth / GTM
    "business development",
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

    // AI-transformation flavored roles (matches recent KPMG positioning)
    "ai transformation",
    "head of ai",
    "ai strategy",
    "ai go-to-market",
  ],

  seniorityKeywords: [
    "director",
    "head of",
    "vp",
    "vice president",
    "chief",
    "cro",
    "cpo",
    "founding",
    "general manager",
    "principal",
    "lead",
  ],
  seniorManagerKeywords: ["senior manager", "sr manager", "sr. manager"],

  // Role-function keywords above are INDICATORS, not a closed set. The dashboard
  // filter no longer requires a positive match against them; it only rejects
  // titles that obviously fall outside Ben's wheelhouse (deep IC engineering,
  // junior ops, finance/accounting back office, etc.). Anything else passes
  // the filter and the AI fit score decides relevance.
  roleExcludeKeywords: [
    // Engineer (broad) — covers Staff/Senior/Solutions/Sales/SWE/SRE/QA/etc.
    // Ben explicitly excludes engineer titles, even Solutions/Sales Engineer.
    "engineer",
    "swe",
    "site reliability",
    "sre",
    "data scientist",
    "research scientist",
    "applied scientist",
    "scientist",

    // Engineering management (Ben's not pitching as eng leader)
    "engineering manager",
    "engineering director",
    "vp engineering",
    "head of engineering",
    "cto",

    // "Technical X" — Ben excluded "technical anything". Catches Technical
    // Lead, Technical Enablement, Technical Account Manager (TAM),
    // Technical Program Manager, Technical Recruiter, etc.
    "technical ",
    "technical,",

    // Research / safety / safeguarding ICs (per Ben: research lead, safeguard analyst, etc.)
    "research lead",
    "research manager",
    "researcher",
    "safeguard",
    "trust and safety",
    "trust & safety",
    "safety analyst",
    "policy analyst",

    // IT / helpdesk / support (broad — any "support" role)
    "support",
    "it support",
    "help desk",
    "helpdesk",
    "desktop support",
    "service desk",

    // Non-US regional roles — Ben is based in Seattle and targeting US
    "dach",
    "emea",
    "apac",
    "latam",
    "anz ",
    "anz,",
    "mena",
    "uk &",
    "uk and",
    "uk,",
    "united kingdom",
    "ireland",

    // Events / field marketing
    "event ",
    "events ",
    "events,",
    "event planner",
    "event manager",
    "events manager",

    // Legal & compliance (broader)
    "legal ",
    "legal,",
    "general counsel",
    "compliance ",
    "compliance,",
    "compliance officer",

    // Design / UX / creative
    "designer",
    "ux ",
    "ui ",
    "creative director",
    "art director",
    "copywriter",
    "graphic",

    // Marketing / comms execution roles (not leadership)
    "marketing coordinator",
    "marketing specialist",
    "marketing associate",
    "social media",
    "content writer",
    "seo specialist",
    "community manager",

    // Finance / accounting back office
    "accountant",
    "accounting",
    "accounts receivable",
    "accounts payable",
    "bookkeeper",
    "bookkeeping",
    "financial analyst",
    "fp&a",
    "controller",
    "audit ",
    "auditor",
    "tax ",
    "tax,",
    "treasury",
    "revenue operations analyst",
    "revenue accounting",

    // People / HR ops
    "recruiter",
    "talent acquisition",
    "hr ",
    "people ops",
    "people operations",

    // Admin / assistant / staff-level (per Ben: no admin, assistant, staff, or similar)
    "admin ",
    "admin,",
    "administrator",
    "administrative",
    "assistant",
    "staff ",
    "staff,",
    "paralegal",
    "legal counsel",
    "office manager",
    "receptionist",
    "coordinator",
    "clerk",
    "secretary",

    // Field / ops / customer support / clinical
    "warehouse",
    "driver",
    "technician",
    "nurse",
    "physician",
    "clinical",
    "barista",
    "cashier",
    "retail associate",

    // Junior / intern levels
    "intern ",
    "internship",
    "associate ",
    "entry-level",
    "entry level",
    "junior ",
  ],

  minTotalCompUsd: 250_000,

  rejectIfRequiresRelocationOutsideSeattle: true,
} as const;

export const SOFT_PREFERENCES = {
  preferredVerticals: [
    // AI / ML — strongest current fit
    "ai",
    "ml",
    "machine learning",
    "genai",
    "llm",
    "agentic",
    "foundation model",
    "ai transformation",
    "ai platform",

    // Enterprise SaaS & infra — Ben's bread and butter
    "b2b saas",
    "enterprise software",
    "developer tools",
    "devtools",
    "cloud",
    "infrastructure",
    "data platform",
    "security",
    "observability",

    // Partner / alliance / ecosystem signals — high relevance per CV
    "partner ecosystem",
    "alliance",
    "alliances",
    "partnerships",
    "channel",
    "gsi",
    "systems integrator",

    // Vertical industries that still fit
    "mobility",
    "ev",
    "climate",
    "energy",
    "industrial",
    "supply chain",
    "manufacturing",
    "product",
    "hardware",
    "sustainability",
    "esg",

    // Investor-side
    "venture capital",
    "vc",
  ],
  deprioritizedVerticals: ["retail banking", "consumer fintech", "gambling", "adult"],

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

// Focused search-time phrase GROUPS for JSearch. Each group becomes one
// parallel API call. Phrases within a group are joined with OR. Keeping
// groups small (2-4 phrases) makes JSearch matching more reliable.
// Each group covers one logical bucket of target roles.
export const AGGREGATOR_QUERY_GROUPS = [
  '"Partner Manager" OR "Alliance Manager" OR "Partnerships Manager"',
  '"Head of Partnerships" OR "Head of Alliances" OR "Head of Ecosystem"',
  '"VP Partnerships" OR "VP Alliances" OR "Director Partnerships" OR "Director Alliances"',
  '"Country Manager" OR "Head of US" OR "Head of North America" OR "GM US"',
  '"VP Business Development" OR "VP Sales" OR "Head of Sales" OR "Head of Growth"',
  '"Customer Success" Lead OR Director OR VP',
  '"Strategic Accounts" OR "Strategic Partnerships" OR "GSI Partner"',
  '"AI Transformation" OR "Head of AI"',
  // Groups 9-12: cover common titling on ZipRecruiter / Bing Jobs not caught above
  '"Partner Development Manager" OR "Partner Development Director"',
  '"Channel Partner" OR "Channel Sales Director" OR "Channel Manager"',
  '"Technology Alliances" OR "Cloud Alliances" OR "ISV Partner" OR "Platform Partner"',
  '"Enterprise Partnerships" OR "Platform Partnerships" OR "Ecosystem Director" OR "Partner Program Manager"',
] as const;

// Legacy single-list form kept for the Profile card preview. Mirrors the
// strongest terms in the groups above.
export const AGGREGATOR_SEARCH_TERMS = [
  "Partner Manager",
  "Alliance Manager",
  "Head of Partnerships",
  "Director Alliances",
  "VP Partnerships",
  "GSI Partner",
  "Ecosystem Lead",
  "Country Manager US",
  "Head of US",
  "VP Business Development",
  "Customer Success VP",
  "Strategic Accounts Director",
  "AI Transformation",
] as const;

// Locations queried against aggregators. Filtering refines this post-fetch.
export const AGGREGATOR_LOCATIONS = ["Seattle", "Remote", "United States"] as const;

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

// Negative filter: reject only obviously off-target titles. Returns true if
// the title is NOT in the exclude list — i.e. acceptable to pass through.
export function titleNotExcluded(title: string): boolean {
  const t = title.toLowerCase();
  return !HARD_FILTER.roleExcludeKeywords.some((k) => t.includes(k));
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
  if (!titleNotExcluded(p.title)) {
    return { keep: false, reason: "title in exclude list (IC engineering / junior / back-office / etc.)" };
  }
  // Seniority + comp are no longer hard gates — they're soft signals the AI fit
  // score weighs. A "Partner Manager" at a vendor can be senior even without
  // "Director/VP/Head" in the title. Comp is often unpublished. Trust the
  // exclude list to catch junior roles and let fit scoring decide the rest.
  if (!compPasses(p.salaryMax)) {
    return { keep: false, reason: "below comp floor (published)" };
  }
  return { keep: true };
}

// Prompt fragment injected into fit-scoring system message. Keep it concise —
// it sits inside the cached system block so it costs once across the batch.
export const HARDCODED_PREFS_PROMPT = `
HARDCODED CANDIDATE PROFILE (authoritative — overrides any conflicting profile blob):

WHO HE IS
- Ben Reiss. Director at KPMG US (Microsoft ecosystem). ~10 years across EY + KPMG.
- German native, Seattle-based. Steering committee member, German American Chamber of Commerce Seattle.
- Built KPMG's EMEA ESG Task Force (35 people, 60+ countries) and KPMG US sustainability practice from zero.
- FY26: sold $2.5M in AI transformation work directly to Microsoft as a client.
- Uses Claude Code daily to build agentic workflows for partner research, account planning, pipeline reporting.

CORE STRENGTHS (weight heavily as fit signals)
- GSI / Big-4 alliance strategy — has worked inside the GSIs and now sells partner programs from the vendor side.
- Microsoft ecosystem partner success: QBRs, joint business planning, co-investment alignment, adoption tracking.
- Partner success lifecycle: adoption, retention, expansion across managed partner portfolios.
- Zero-to-one team building, capability frameworks, GTM motion design.
- Agentic AI / Claude Code fluency.
- Cross-cultural EMEA ↔ US execution.

GEOGRAPHY
- Based in Seattle, WA. Will not relocate outside Seattle metro.
- Acceptable locations: Seattle metro, US-remote. For German employers, anywhere in North America.

TARGET ROLES (INDICATORS, NOT A CLOSED LIST — any adjacent / related role that draws on the same skill set should also score as a fit)
Strongest fit (score 80+ if otherwise solid):
- Partner Manager / Alliance Manager / Partner Success Lead / GSI Partner Lead — at any vendor in the AI, cloud, or B2B SaaS space (e.g. Anthropic, OpenAI, Databricks, Snowflake, MongoDB, Confluent, AWS, GCP, Salesforce, ServiceNow, SAP, Microsoft).
- Head of Ecosystem / Head of Partnerships / VP Partnerships / Director of Partnerships.
- Country Manager / Head of US / GM US — especially for European (ideally German) firms entering or scaling in the US.

Strong fit (score 70+):
- Business Development leadership (Head of BD, VP BD, Director of BD).
- Strategic Accounts / Enterprise Sales leadership (VP Sales, Head of Sales, Director of Sales).
- Growth / GTM leadership at AI-native or partner-heavy companies.
- AI Transformation lead / Head of AI / AI Go-to-Market lead.

Related / adjacent roles to also consider (score on merits — do NOT require an exact title match):
- Customer Success leadership (VP CS, Head of CS) — partner success skills transfer.
- Solutions / Pre-sales leadership (VP Solutions, Head of Solutions Engineering) when partner-facing.
- Channel / Reseller program leadership.
- Strategic alliances within a specific industry (e.g. "Head of Cloud Alliances", "Director Microsoft Alliance", "Lead — AWS Partnership").
- Revenue Operations leadership if framed strategically.
- Practice / Capability leadership inside a vendor (not another Big-4 seat).
- Founding GTM hire / first US hire at a Series B+ startup.
- Strategic / corporate development at a software vendor.
- Industry GM (e.g. "GM — Financial Services" at a SaaS vendor) when partner-led.
- Anything titled "Head of <X>" or "VP <X>" where <X> is partner, alliance, ecosystem, channel, sales, growth, GTM, BD, customer success, or solutions.

Use judgment for roles that don't appear on this list. Skills overlap matters more than title overlap.

SENIORITY & COMP
- Target seniority: Director, VP, Head of. Senior Manager OK only if total comp >= $250k.
- Minimum total comp (base + bonus, ignoring equity): $250,000.
- Acceptable travel: up to 50%.

VERTICALS
- PREFERRED (boost): AI/ML/GenAI/Agentic, enterprise SaaS, dev tools, cloud infra, data platforms, security, observability, partner-ecosystem businesses, mobility/EV/climate/energy/industrial/supply chain, sustainability/ESG, hardware, venture capital.
- DEPRIORITIZED (slight penalty, not exclusion): retail banking, consumer fintech, gambling, adult.

GERMAN ANGLE
- GERMAN-firm postings (sources aggregator_german_us, aggregator_indeed_de): apply a +15 fit boost AND ignore the strict role/seniority/comp filters (comp is often non-public for first-US-hire roles).
- German-language JDs or roles requiring German-counterparty work: treat fluency as a meaningful strength even without a German employer.

DEALBREAKERS
- Requires relocation outside Seattle metro.

SCORING GUIDANCE
- A "Partner Manager — Microsoft Alliance" or "Head of GSI Partnerships" type role at an AI/SaaS vendor should score 85+.
- A generic VP Sales role outside the partner ecosystem may still pass filters but should typically score 60–75.
- A first-US-hire role at a German B2B AI/SaaS company should score 80+ even without published comp.
- An adjacent role (Customer Success VP, Solutions Lead at a cloud vendor, Strategic Accounts Director, Channel Sales lead, founding GTM hire) — score on merits based on skill overlap. Do not penalize for not matching the indicator titles exactly.
- Consulting / Big-4 senior manager roles (anything that looks like another KPMG/EY/Deloitte/PwC seat): score below 50 unless explicitly partner-program-focused.
- IC engineering, junior roles, back-office finance/HR/legal/admin: should already be filtered out before reaching you. If one slips through, score below 30.
`.trim();