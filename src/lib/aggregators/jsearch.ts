import type { AggregatorPosting, SeniorityLevel } from "@/lib/types";

const SENIORITY_LABEL: Partial<Record<SeniorityLevel, string>> = {
  intern: "Intern",
  junior: "Junior",
  senior: "Senior",
  staff: "Staff",
  principal: "Principal",
  director: "Director",
  vp: "VP",
  c_level: "C-level",
  // "mid" intentionally omitted — no search prefix needed
};

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
  roleKeywords: string[];
  locations: string[]; // free-form (e.g. "Remote", "San Francisco, CA")
  remote: boolean;
  seniorityLevels?: SeniorityLevel[];
};

export async function fetchJSearch(query: JSearchQuery): Promise<AggregatorPosting[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];

  const seniorityTerms = (query.seniorityLevels ?? [])
    .map((s) => SENIORITY_LABEL[s])
    .filter(Boolean) as string[];
  const seniorityPrefix =
    seniorityTerms.length > 1
      ? `(${seniorityTerms.join(" OR ")}) `
      : seniorityTerms.length === 1
        ? `${seniorityTerms[0]} `
        : "";

  const role = query.roleKeywords.join(" OR ");
  const location = query.remote ? "" : ` in ${query.locations.join(" OR ")}`;
  const q = `${seniorityPrefix}${role}${location}`.trim() || "software engineer";
  const url = new URL("https://jsearch.p.rapidapi.com/search");
  url.searchParams.set("query", q);
  url.searchParams.set("date_posted", "today");
  url.searchParams.set("num_pages", "2");
  if (query.remote) url.searchParams.set("remote_jobs_only", "true");

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`jsearch: ${res.status}`);
  const json = (await res.json()) as JSearchResponse;

  return (json.data ?? []).map((j) => ({
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
  }));
}
