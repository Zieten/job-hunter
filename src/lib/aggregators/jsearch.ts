import type { AggregatorPosting } from "@/lib/types";

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
};

type JSearchResponse = { status: string; data: JSearchJob[] };

export type JSearchQuery = {
  // We now run multiple parallel queries — one per phrase group — and dedupe.
  // Each phrase string becomes a single JSearch `query` parameter.
  phrases: string[];
  remote: boolean;
};

// Run several focused queries in parallel and dedupe by job_id. Each query gets
// one OR-joined phrase group rather than a single mega-OR that JSearch struggles
// with. date_posted=week — "today" was dropping ~95% of valid results.
export async function fetchJSearch(query: JSearchQuery): Promise<AggregatorPosting[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];

  const tasks = query.phrases.map((phrase) => runQuery(phrase, query.remote, key));
  const settled = await Promise.allSettled(tasks);
  const all: JSearchJob[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") all.push(...r.value);
    else console.error("[jsearch] query failed:", r.reason);
  }

  // Dedupe by job_id
  const seen = new Set<string>();
  const deduped: JSearchJob[] = [];
  for (const j of all) {
    if (seen.has(j.job_id)) continue;
    seen.add(j.job_id);
    deduped.push(j);
  }

  return deduped.map(toPosting);
}

async function runQuery(phrase: string, remote: boolean, key: string): Promise<JSearchJob[]> {
  const url = new URL("https://jsearch.p.rapidapi.com/search");
  url.searchParams.set("query", phrase);
  url.searchParams.set("date_posted", "week");
  url.searchParams.set("num_pages", "2");
  if (remote) url.searchParams.set("remote_jobs_only", "true");

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`jsearch ${res.status} for "${phrase}"`);
  const json = (await res.json()) as JSearchResponse;
  return json.data ?? [];
}

function toPosting(j: JSearchJob): AggregatorPosting {
  return {
    source: "aggregator_jsearch" as const,
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
  };
}
