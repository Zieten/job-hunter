import type { Company } from "@prisma/client";
import type { RawPosting } from "@/lib/types";

type AshbyResponse = {
  jobs: {
    id: string;
    title: string;
    location: string;
    isRemote: boolean;
    employmentType: string;
    publishedAt: string;
    jobUrl: string;
    descriptionHtml: string;
    descriptionPlain?: string;
    compensation?: { summary?: string; minValue?: number; maxValue?: number; currencyCode?: string };
  }[];
};

export async function fetchAshby(company: Company): Promise<RawPosting[]> {
  if (!company.atsSlug) throw new Error("ashby: missing atsSlug");
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(company.atsSlug)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`ashby ${company.atsSlug}: ${res.status}`);
  const data = (await res.json()) as AshbyResponse;
  return (data.jobs ?? []).map((j) => ({
    externalId: j.id,
    title: j.title,
    location: j.location ?? null,
    remote: !!j.isRemote,
    salaryText: j.compensation?.summary ?? null,
    salaryMin: j.compensation?.minValue ?? null,
    salaryMax: j.compensation?.maxValue ?? null,
    salaryCurrency: j.compensation?.currencyCode ?? null,
    url: j.jobUrl,
    descriptionMd: j.descriptionPlain ?? stripHtml(j.descriptionHtml ?? ""),
    postedAt: j.publishedAt ? new Date(j.publishedAt) : null,
  }));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
