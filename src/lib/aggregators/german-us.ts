import type { AggregatorPosting, SeniorityLevel } from "@/lib/types";

// Curated seed list — German firms with active US hiring. Mix of mid-size
// scaleups (Series B–D), AI labs, and larger enterprises with established US
// partner / alliance programs. Used as a strong signal for the German-firm
// filter (alongside .de URLs, GmbH/AG legal forms, HQ phrases, and German
// city mentions in the JD).
const GERMAN_FIRMS_SEED = [
  // AI / ML labs
  "Aleph Alpha",
  "Helsing",
  "Black Forest Labs",
  "DeepL",
  "Parloa",
  "Bryter",

  // Enterprise SaaS / process / data
  "Personio",
  "Celonis",
  "Camunda",
  "Contentful",
  "Mambu",
  "Staffbase",
  "Leapsome",
  "Userlane",
  "Demodesk",
  "TeamViewer",
  "SAP",

  // Productivity / collaboration
  "Pitch",
  "CoachHub",
  "Babbel",
  "Localyze",
  "Workmotion",

  // Logistics / mobility / industrial
  "Forto",
  "Sennder",
  "Choco",
  "Tacto",
  "NavVis",
  "Quantum Systems",
  "Lilium",
  "Volocopter",
  "Wandelbots",
  "Konux",
  "Vay",
  "Wunder Mobility",
  "KION Group",

  // Fintech
  "N26",
  "Trade Republic",
  "Solaris",
  "Solarisbank",
  "Penta",

  // Consumer / marketplace
  "GetYourGuide",
  "HelloFresh",
  "Awin",
  "Foodspring",
  "Zalando",

  // Large enterprise (US presence + alliance programs)
  "Bosch",
  "Siemens",
  "Trumpf",
  "Henkel",
  "Bayer",
  "Allianz",
  "BMW Group",
  "Mercedes-Benz",
  "Volkswagen Group of America",
  "ZF Friedrichshafen",
  "Continental",
];

// German legal-entity suffixes that survive on the raw employer name even
// when normalization would strip them. Strong positive signal.
const GERMAN_LEGAL_FORMS = [" gmbh", " gmbh.", " ag", " se ", " se,", " se.", " kg", " ohg", " ug"];

// German cities — appearing in employer name or description is a soft signal.
const GERMAN_CITIES = [
  "berlin",
  "munich",
  "münchen",
  "muenchen",
  "hamburg",
  "frankfurt",
  "stuttgart",
  "düsseldorf",
  "dusseldorf",
  "cologne",
  "köln",
  "koeln",
  "leipzig",
  "dresden",
  "nuremberg",
  "nürnberg",
  "karlsruhe",
  "heidelberg",
  "bremen",
  "hannover",
  "essen",
  "dortmund",
];

const US_PRESENCE_TITLES = [
  "Country Manager US",
  "Country Manager USA",
  "Head of US",
  "Head of USA",
  "Head of North America",
  "VP US",
  "VP USA",
  "VP North America",
  "US General Manager",
  "General Manager Americas",
  "US Business Development",
  "Director US Business Development",
  "US Growth",
  "Head of US Growth",
  "Regional Director Americas",
  "Director US Sales",
  "VP US Sales",
];

// Explicit HQ phrases — strong signal that a posting belongs to a German firm.
// Includes German-language equivalents in case the firm posted in German on a
// US-facing source (occasional with Berlin scaleups posting bilingual JDs).
const GERMAN_HQ_PHRASES = [
  // English
  "headquartered in germany",
  "headquartered in berlin",
  "headquartered in munich",
  "headquartered in münchen",
  "based in germany",
  "based in berlin",
  "based in munich",
  "german company",
  "german scale-up",
  "german scaleup",
  "german startup",
  "founded in germany",
  "founded in berlin",
  "founded in munich",
  "founded in münchen",
  "german tech company",
  // German
  "deutsches unternehmen",
  "deutsches scale-up",
  "deutsches scaleup",
  "deutsches startup",
  "deutsches tech-unternehmen",
  "mit sitz in deutschland",
  "mit sitz in berlin",
  "mit sitz in münchen",
  "hauptsitz in deutschland",
  "hauptsitz in berlin",
  "hauptsitz in münchen",
  "gegründet in deutschland",
  "gegründet in berlin",
  "gegründet in münchen",
];

type JSearchJob = {
  job_id: string;
  employer_name: string;
  job_title: string;
  job_apply_link: string;
  job_description: string;
  job_city: string | null;
  job_state: string | null;
  job_country: string | null;
  job_is_remote: boolean;
  job_posted_at_datetime_utc: string | null;
  job_min_salary: number | null;
  job_max_salary: number | null;
  job_salary_currency: string | null;
  job_publisher: string;
  employer_website?: string | null;
};

type JSearchResponse = { status: string; data: JSearchJob[] };

function normalizeCompany(n: string): string {
  return n
    .toLowerCase()
    .replace(/\b(gmbh|ag|se|kg|ohg|mbh|ug|inc|llc|ltd)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SEED_NORMALIZED = new Set(GERMAN_FIRMS_SEED.map(normalizeCompany));

function hostEndsWith(url: string, suffix: string): boolean {
  try {
    return new URL(url).host.toLowerCase().endsWith(suffix);
  } catch {
    return false;
  }
}

function isGermanFirm(j: JSearchJob): boolean {
  // 1. Seed list (strong signal)
  if (SEED_NORMALIZED.has(normalizeCompany(j.employer_name))) return true;

  // 2. .de URL (strong signal)
  if (hostEndsWith(j.job_apply_link, ".de")) return true;
  if (j.employer_website && hostEndsWith(j.employer_website, ".de")) return true;

  // 3. German legal form in raw employer name (strong signal — "Foo GmbH",
  //    "Bar AG", etc. survives normalization)
  const rawName = ` ${(j.employer_name ?? "").toLowerCase()} `;
  if (GERMAN_LEGAL_FORMS.some((s) => rawName.includes(s))) return true;

  // 4. Explicit HQ phrase in description (strong signal)
  const desc = (j.job_description ?? "").toLowerCase();
  if (GERMAN_HQ_PHRASES.some((p) => desc.includes(p))) return true;

  // 5. German city in employer name (moderate signal — "ACME Munich" etc.)
  if (GERMAN_CITIES.some((c) => rawName.includes(` ${c} `) || rawName.includes(` ${c},`))) {
    return true;
  }

  // 6. Multiple German city mentions in description (weak but cumulative signal —
  //    catches firms that say "our HQ in Berlin, with offices in Munich and..." )
  const cityHits = GERMAN_CITIES.reduce((n, c) => (desc.includes(c) ? n + 1 : n), 0);
  if (cityHits >= 2) return true;

  return false;
}

export type GermanUsQuery = {
  seniorityLevels?: SeniorityLevel[];
};

// Run several focused queries in parallel — JSearch handles short OR clauses
// far better than one mega-OR with 16 quoted phrases.
const QUERY_GROUPS = [
  '"Country Manager US" OR "Country Manager USA" OR "Head of US" OR "Head of USA"',
  '"Head of North America" OR "VP North America" OR "VP US" OR "VP USA"',
  '"General Manager US" OR "US General Manager" OR "GM US" OR "Regional Director Americas"',
  '"US Business Development" OR "VP US Sales" OR "Director US Sales" OR "US Growth"',
  '"Head of Partnerships US" OR "Director Partnerships US" OR "VP Partnerships Americas"',
];

export async function fetchGermanToUsRoles(_query: GermanUsQuery): Promise<AggregatorPosting[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];

  const tasks = QUERY_GROUPS.map((phrase) => runQuery(phrase, key));
  const settled = await Promise.allSettled(tasks);
  const all: JSearchJob[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") all.push(...r.value);
    else console.error("[german-us] query failed:", r.reason);
  }

  // Dedupe by job_id, then filter for German firms.
  const seen = new Set<string>();
  const deduped: JSearchJob[] = [];
  for (const j of all) {
    if (seen.has(j.job_id)) continue;
    seen.add(j.job_id);
    deduped.push(j);
  }

  return deduped.filter(isGermanFirm).map((j) => ({
    source: "aggregator_german_us" as const,
    externalId: j.job_id,
    companyNameRaw: j.employer_name,
    title: j.job_title,
    location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ") || null,
    remote: !!j.job_is_remote,
    salaryText:
      j.job_min_salary && j.job_max_salary
        ? `${j.job_salary_currency ?? ""} ${j.job_min_salary}-${j.job_max_salary}`.trim()
        : null,
    salaryMin: j.job_min_salary ?? null,
    salaryMax: j.job_max_salary ?? null,
    salaryCurrency: j.job_salary_currency ?? null,
    url: j.job_apply_link,
    descriptionMd: j.job_description ?? "",
    postedAt: j.job_posted_at_datetime_utc ? new Date(j.job_posted_at_datetime_utc) : null,
  }));
}

async function runQuery(phrase: string, key: string): Promise<JSearchJob[]> {
  const url = new URL("https://jsearch.p.rapidapi.com/search");
  url.searchParams.set("query", `${phrase} in United States`);
  url.searchParams.set("date_posted", "week");
  url.searchParams.set("num_pages", "2");

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`jsearch (german-us) ${res.status} for "${phrase}"`);
  const json = (await res.json()) as JSearchResponse;
  return json.data ?? [];
}
