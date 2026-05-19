import type { AggregatorPosting } from "@/lib/types";

// US-presence titles a German firm would post when hiring their first US
// person. Two sets — English (German firms often keep "Head of US" as-is) and
// German (Geschäftsführer USA, Leiter USA, etc.). Queried separately because
// (a) keeps each OR-clause short and ranked well, (b) easy to tune each side.
const US_PRESENCE_TITLES_EN = [
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

const US_PRESENCE_TITLES_DE = [
  "Geschäftsführer USA",
  "Geschäftsführung USA",
  "Leiter USA",
  "Leitung USA",
  "Niederlassungsleiter USA",
  "Niederlassungsleitung USA",
  "Standortleiter USA",
  "Standortleitung USA",
  "Vertriebsleiter USA",
  "Vertriebsleitung USA",
  "Leiter Nordamerika",
  "Leitung Nordamerika",
  "Geschäftsentwicklung USA",
  "Markteintritt USA",
  "Markterschließung USA",
  "Expansion USA",
  "Vertrieb USA",
];

// Defensive shape — Indeed12 / similar RapidAPI Indeed scrapers vary in field
// names. We accept several plausible variants and pick whichever is present.
type IndeedHitLoose = {
  id?: string;
  job_id?: string;
  jobkey?: string;
  title?: string;
  job_title?: string;
  company_name?: string;
  company?: string;
  employer_name?: string;
  location?: string;
  job_location?: string;
  formatted_location?: string;
  link?: string;
  url?: string;
  job_url?: string;
  apply_link?: string;
  description?: string;
  snippet?: string;
  job_description?: string;
  posted_at?: string;
  date?: string;
  formatted_relative_time?: string;
  salary?: string;
  formatted_salary?: string;
  is_remote?: boolean;
  remote?: boolean;
};

type IndeedSearchResponseLoose = {
  hits?: IndeedHitLoose[];
  data?: IndeedHitLoose[];
  jobs?: IndeedHitLoose[];
  results?: IndeedHitLoose[];
};

function firstString(...vals: (string | null | undefined)[]): string | null {
  for (const v of vals) if (typeof v === "string" && v.length > 0) return v;
  return null;
}

function normalizeUrl(raw: string | null): string {
  if (!raw) return "";
  if (raw.startsWith("http")) return raw;
  // Indeed sometimes returns paths like "/cmp/.../jobs/..." — prefix de.indeed.com.
  return `https://de.indeed.com${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function parsePostedAt(s: string | null): Date | null {
  if (!s) return null;
  // ISO date — happy path.
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);
  // "30+ days ago" / "5 days ago" — best-effort.
  const m = s.match(/(\d+)\s*\+?\s*days? ago/i);
  if (m) {
    const d = new Date();
    d.setDate(d.getDate() - Number(m[1]));
    return d;
  }
  return null;
}

function mapHit(h: IndeedHitLoose): AggregatorPosting | null {
  const externalId = firstString(h.id, h.job_id, h.jobkey);
  const title = firstString(h.title, h.job_title);
  const company = firstString(h.company_name, h.company, h.employer_name);
  const linkRaw = firstString(h.link, h.url, h.job_url, h.apply_link);
  if (!externalId || !title || !company || !linkRaw) return null;

  return {
    source: "aggregator_indeed_de" as const,
    externalId,
    companyNameRaw: company,
    title,
    location: firstString(h.location, h.job_location, h.formatted_location),
    remote: !!(h.is_remote ?? h.remote),
    salaryText: firstString(h.salary, h.formatted_salary),
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    url: normalizeUrl(linkRaw),
    descriptionMd:
      firstString(h.description, h.snippet, h.job_description) ??
      "[Full description on Indeed — open the listing to view.]",
    postedAt: parsePostedAt(firstString(h.posted_at, h.date, h.formatted_relative_time)),
  };
}

// Endpoint shape — confirmed against Indeed12 on RapidAPI. If you switch to a
// different Indeed scraper, only `HOST`, the URL path, and the `mapHit` field
// names should need touching.
const HOST = "indeed12.p.rapidapi.com";

async function queryIndeedDe(key: string, titles: string[]): Promise<AggregatorPosting[]> {
  // OR-clause across the title set. Quote each phrase so multi-word titles
  // ("Country Manager US", "Geschäftsführer USA") match as units.
  const query = titles.map((t) => `"${t}"`).join(" OR ");

  const url = new URL(`https://${HOST}/jobs/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("location", "United States");
  url.searchParams.set("locality", "de"); // search the German Indeed surface
  url.searchParams.set("start", "0");

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": HOST,
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`indeed-de: ${res.status}`);
  const json = (await res.json()) as IndeedSearchResponseLoose;

  const hits = json.hits ?? json.data ?? json.jobs ?? json.results ?? [];
  return hits.map(mapHit).filter((p): p is AggregatorPosting => p !== null);
}

export async function fetchIndeedDe(): Promise<AggregatorPosting[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];

  // Run English + German title queries in parallel; de.indeed.com hosts both.
  const [en, de] = await Promise.all([
    queryIndeedDe(key, US_PRESENCE_TITLES_EN).catch((e) => {
      console.error("[indeed-de:en]", e);
      return [] as AggregatorPosting[];
    }),
    queryIndeedDe(key, US_PRESENCE_TITLES_DE).catch((e) => {
      console.error("[indeed-de:de]", e);
      return [] as AggregatorPosting[];
    }),
  ]);

  // Dedupe by externalId — same posting can appear in both queries.
  const seen = new Set<string>();
  const merged: AggregatorPosting[] = [];
  for (const p of [...en, ...de]) {
    if (seen.has(p.externalId)) continue;
    seen.add(p.externalId);
    merged.push(p);
  }
  return merged;
}
