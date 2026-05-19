import type { Company } from "@prisma/client";
import type { RawPosting } from "@/lib/types";

type LeverJob = {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl: string;
  categories: { location?: string; team?: string; commitment?: string };
  description: string;        // HTML
  descriptionPlain: string;   // plain text
  createdAt: number;
  workplaceType?: string;
  salaryRange?: { min: number; max: number; currency: string; interval: string };
};

export async function fetchLever(company: Company): Promise<RawPosting[]> {
  if (!company.atsSlug) throw new Error("lever: missing atsSlug");
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(company.atsSlug)}?mode=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`lever ${company.atsSlug}: ${res.status}`);
  const jobs = (await res.json()) as LeverJob[];
  return jobs.map((j) => ({
    externalId: j.id,
    title: j.text,
    location: j.categories.location ?? null,
    remote: j.workplaceType === "remote" || /remote/i.test(j.categories.location ?? ""),
    salaryText: j.salaryRange ? `${j.salaryRange.currency} ${j.salaryRange.min}-${j.salaryRange.max}/${j.salaryRange.interval}` : null,
    salaryMin: j.salaryRange?.min ?? null,
    salaryMax: j.salaryRange?.max ?? null,
    salaryCurrency: j.salaryRange?.currency ?? null,
    url: j.hostedUrl ?? j.applyUrl,
    descriptionMd: j.descriptionPlain || stripHtml(j.description ?? ""),
    postedAt: j.createdAt ? new Date(j.createdAt) : null,
  }));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
