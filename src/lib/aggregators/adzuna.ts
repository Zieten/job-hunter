import type { AggregatorPosting } from "@/lib/types";

type AdzunaJob = {
  id: string;
  title: string;
  description: string;
  redirect_url: string;
  company: { display_name: string };
  location: { display_name: string };
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  created: string;
};

type AdzunaResponse = { results: AdzunaJob[] };

export type AdzunaQuery = {
  roleKeywords: string[];
  location: string;        // single primary location for Adzuna
  salaryMin?: number;
  remote: boolean;
};

export async function fetchAdzuna(query: AdzunaQuery): Promise<AggregatorPosting[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const country = (process.env.ADZUNA_COUNTRY ?? "us").toLowerCase();
  if (!appId || !appKey) return [];

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("results_per_page", "30");
  url.searchParams.set("what", query.roleKeywords.join(" "));
  if (!query.remote && query.location) url.searchParams.set("where", query.location);
  if (query.salaryMin) url.searchParams.set("salary_min", String(query.salaryMin));
  url.searchParams.set("max_days_old", "1");
  url.searchParams.set("sort_by", "date");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`adzuna: ${res.status}`);
  const json = (await res.json()) as AdzunaResponse;

  return (json.results ?? []).map((j) => ({
    source: "aggregator_adzuna" as const,
    externalId: String(j.id),
    companyNameRaw: j.company.display_name,
    title: j.title,
    location: j.location?.display_name ?? null,
    remote: /remote/i.test(j.location?.display_name ?? "") || query.remote,
    salaryText:
      j.salary_min && j.salary_max
        ? `${Math.round(j.salary_min)}-${Math.round(j.salary_max)}${j.salary_is_predicted === "1" ? " (est)" : ""}`
        : null,
    salaryMin: j.salary_min ? Math.round(j.salary_min) : null,
    salaryMax: j.salary_max ? Math.round(j.salary_max) : null,
    salaryCurrency: null,
    url: j.redirect_url,
    descriptionMd: j.description ?? "",
    postedAt: j.created ? new Date(j.created) : null,
  }));
}
