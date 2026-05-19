// Discovers Series C/D companies hiring for BD/Sales/GTM roles in the US.
// Used by the weekly /api/cron/discover endpoint to grow the company watchlist.

export type DiscoveredCompany = {
  companyName: string;
  fundingStage: "Series C" | "Series D";
};

type JSearchJob = {
  job_id: string;
  employer_name: string;
};

type JSearchResponse = { status: string; data: JSearchJob[] };

const BD_ROLE_TERMS = [
  "Business Development",
  "VP Sales",
  "Head of Sales",
  "VP Business Development",
  "Go-to-Market",
  "Account Executive",
  "Revenue Operations",
  "Sales Director",
  "Chief Revenue Officer",
];

async function searchStage(
  stage: "Series C" | "Series D",
  apiKey: string,
): Promise<DiscoveredCompany[]> {
  const roleClause = BD_ROLE_TERMS.map((t) => `"${t}"`).join(" OR ");
  const q = `"${stage}" (${roleClause}) in United States`;
  const url = new URL("https://jsearch.p.rapidapi.com/search");
  url.searchParams.set("query", q);
  url.searchParams.set("date_posted", "month");
  url.searchParams.set("num_pages", "3");

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`jsearch (growth-discovery ${stage}): ${res.status}`);
  const json = (await res.json()) as JSearchResponse;

  const seen = new Set<string>();
  const out: DiscoveredCompany[] = [];
  for (const j of json.data ?? []) {
    const name = j.employer_name?.trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push({ companyName: name, fundingStage: stage });
  }
  return out;
}

// Returns deduped list of growth-stage companies found via JSearch BD/Sales queries.
// When a company appears in both Series C and D results, Series D wins.
export async function discoverGrowthCompanies(): Promise<DiscoveredCompany[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];

  const [seriesC, seriesD] = await Promise.all([
    searchStage("Series C", key).catch((e) => { console.error("[growth-discovery Series C]", e); return []; }),
    searchStage("Series D", key).catch((e) => { console.error("[growth-discovery Series D]", e); return []; }),
  ]);

  // Merge with Series D taking precedence
  const byKey = new Map<string, DiscoveredCompany>();
  for (const c of [...seriesC, ...seriesD]) {
    byKey.set(c.companyName.toLowerCase(), c);
  }
  return Array.from(byKey.values());
}
