import type { AggregatorPosting, SeniorityLevel } from "@/lib/types";

// Curated seed list — German mid-size firms (Series B–D, ~100–1000 employees)
// actively expanding into the US but not yet well-established there.
const GERMAN_FIRMS_SEED = [
  "Personio",
  "DeepL",
  "Pitch",
  "Forto",
  "Sennder",
  "GetYourGuide",
  "Mambu",
  "Babbel",
  "Aleph Alpha",
  "Helsing",
  "Black Forest Labs",
  "Parloa",
  "Camunda",
  "Staffbase",
  "CoachHub",
  "Quantum Systems",
  "NavVis",
  "Leapsome",
  "Tacto",
  "Choco",
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
  if (SEED_NORMALIZED.has(normalizeCompany(j.employer_name))) return true;
  if (hostEndsWith(j.job_apply_link, ".de")) return true;
  if (j.employer_website && hostEndsWith(j.employer_website, ".de")) return true;

  const desc = (j.job_description ?? "").toLowerCase();
  if (GERMAN_HQ_PHRASES.some((p) => desc.includes(p))) return true;

  return false;
}

export type GermanUsQuery = {
  seniorityLevels?: SeniorityLevel[];
};

export async function fetchGermanToUsRoles(query: GermanUsQuery): Promise<AggregatorPosting[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];

  const titleClause = `(${US_PRESENCE_TITLES.map((t) => `"${t}"`).join(" OR ")})`;
  const q = `${titleClause} in United States`;
  const url = new URL("https://jsearch.p.rapidapi.com/search");
  url.searchParams.set("query", q);
  url.searchParams.set("date_posted", "week");
  url.searchParams.set("num_pages", "2");

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`jsearch (german-us): ${res.status}`);
  const json = (await res.json()) as JSearchResponse;

  return (json.data ?? []).filter(isGermanFirm).map((j) => ({
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
