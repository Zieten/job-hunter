import * as cheerio from "cheerio";
import type { Company } from "@prisma/client";
import type { RawPosting } from "@/lib/types";

const UA = "Mozilla/5.0 (compatible; JobHunterBot/1.0)";

// Best-effort HTML scrape. Finds anchor links whose href or text suggest a job posting.
// Limited reliability — companies with custom career pages will need a dedicated adapter
// or should be flagged needs_attention in the UI.
export async function fetchGeneric(company: Company): Promise<RawPosting[]> {
  if (!company.careersUrl) throw new Error("generic: missing careersUrl");
  const res = await fetch(company.careersUrl, {
    headers: { "User-Agent": UA, "Accept": "text/html" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`generic ${company.name}: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const base = new URL(company.careersUrl);
  const seen = new Set<string>();
  const out: RawPosting[] = [];

  $("a").each((_, a) => {
    const href = $(a).attr("href");
    const text = $(a).text().trim();
    if (!href || !text || text.length < 4) return;
    if (!/job|career|position|role|posting/i.test(href + " " + text)) return;
    let abs: string;
    try {
      abs = new URL(href, base).toString();
    } catch {
      return;
    }
    if (seen.has(abs)) return;
    seen.add(abs);
    out.push({
      externalId: hashId(abs),
      title: text.replace(/\s+/g, " ").slice(0, 200),
      location: null,
      remote: /remote/i.test(text),
      salaryText: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      url: abs,
      descriptionMd: `(Auto-discovered job link from ${company.name} careers page. Open the link for the full description.)`,
      postedAt: null,
    });
  });

  return out.slice(0, 50);
}

function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return `g_${(h >>> 0).toString(36)}`;
}
