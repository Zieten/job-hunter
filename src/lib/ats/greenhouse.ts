import type { Company } from "@prisma/client";
import type { RawPosting } from "@/lib/types";

type GhJob = {
  id: number;
  title: string;
  location: { name: string };
  absolute_url: string;
  content: string; // HTML
  updated_at: string;
  metadata?: { name: string; value: string | null }[] | null;
};

type GhResponse = { jobs: GhJob[] };

export async function fetchGreenhouse(company: Company): Promise<RawPosting[]> {
  if (!company.atsSlug) throw new Error("greenhouse: missing atsSlug");
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company.atsSlug)}/jobs?content=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`greenhouse ${company.atsSlug}: ${res.status}`);
  const data = (await res.json()) as GhResponse;
  return data.jobs.map((j) => ({
    externalId: String(j.id),
    title: j.title,
    location: j.location?.name ?? null,
    remote: /remote/i.test(j.location?.name ?? ""),
    salaryText: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    url: j.absolute_url,
    descriptionMd: htmlToMarkdown(j.content ?? ""),
    postedAt: j.updated_at ? new Date(j.updated_at) : null,
  }));
}

function htmlToMarkdown(html: string): string {
  // Lightweight HTML -> text. We keep paragraphs and bullets, drop tags.
  return html
    .replace(/<br\s*\/?>(\n)?/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
