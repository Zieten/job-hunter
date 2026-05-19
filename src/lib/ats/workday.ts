import type { Company } from "@prisma/client";
import type { RawPosting } from "@/lib/types";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type WdSearchResponse = {
  total: number;
  jobPostings: {
    title: string;
    externalPath: string;        // e.g. /job/Some-Title_R123
    locationsText: string;
    postedOn: string;
    bulletFields?: string[];
  }[];
};

type WdDetailResponse = {
  jobPostingInfo: {
    title: string;
    location: string;
    postedOn: string;
    jobDescription: string;       // HTML
    externalUrl: string;
    jobReqId: string;
  };
};

export async function fetchWorkday(company: Company): Promise<RawPosting[]> {
  if (!company.atsTenant || !company.atsHost || !company.atsSite) {
    throw new Error("workday: missing atsTenant/atsHost/atsSite");
  }
  const base = `https://${company.atsTenant}.${company.atsHost}.myworkdayjobs.com/wday/cxs/${company.atsTenant}/${company.atsSite}`;
  // Step 1: list jobs (first page only — 20 per page is plenty for once-a-day scan)
  const listRes = await fetch(`${base}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": UA,
    },
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "" }),
    signal: AbortSignal.timeout(20000),
  });
  if (!listRes.ok) throw new Error(`workday list ${company.atsTenant}: ${listRes.status}`);
  const list = (await listRes.json()) as WdSearchResponse;

  const results: RawPosting[] = [];
  for (const j of list.jobPostings) {
    try {
      const detailRes = await fetch(`${base}${j.externalPath}`, {
        headers: { "Accept": "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(15000),
      });
      if (!detailRes.ok) continue;
      const detail = (await detailRes.json()) as WdDetailResponse;
      const info = detail.jobPostingInfo;
      results.push({
        externalId: info.jobReqId,
        title: info.title,
        location: info.location ?? j.locationsText ?? null,
        remote: /remote/i.test(info.location ?? j.locationsText ?? ""),
        salaryText: null,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        url: info.externalUrl,
        descriptionMd: stripHtml(info.jobDescription ?? ""),
        postedAt: info.postedOn ? new Date(info.postedOn) : null,
      });
    } catch {
      continue;
    }
  }
  return results;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>(\n)?/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
