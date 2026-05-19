import type { AggregatorPosting, Preferences } from "@/lib/types";
import { fetchJSearch } from "./jsearch";
import { fetchAdzuna } from "./adzuna";
import { fetchGermanToUsRoles } from "./german-us";
import { fetchIndeedDe } from "./indeed-de";
import { AGGREGATOR_SEARCH_TERMS, AGGREGATOR_LOCATIONS } from "@/lib/profile-hardcoded";

// Run all aggregators (those that are configured via env vars) in parallel.
// roleKeywords / locations are hardcoded (see profile-hardcoded.ts). The
// `prefs` parameter is retained only for `seniority` and `salaryMin` —
// everything else now comes from the hardcoded profile.
export async function fetchAggregatorPostings(prefs: Preferences): Promise<AggregatorPosting[]> {
  const roleKeywords = [...AGGREGATOR_SEARCH_TERMS];
  const locations = [...AGGREGATOR_LOCATIONS];
  const remote = true;

  const tasks: Promise<AggregatorPosting[]>[] = [];
  if (process.env.RAPIDAPI_KEY) {
    tasks.push(
      fetchJSearch({ roleKeywords, locations, remote, seniorityLevels: prefs.seniority }).catch((e) => {
        console.error("[jsearch]", e);
        return [];
      }),
    );
    // Always-on: German firms hiring for US-facing roles (Country Manager US,
    // Head of US, US BizDev, etc.). Shares the JSearch API key.
    tasks.push(
      fetchGermanToUsRoles({ seniorityLevels: prefs.seniority }).catch((e) => {
        console.error("[german-us]", e);
        return [];
      }),
    );
    // Always-on: same role set, but queried against the German Indeed surface
    // (de.indeed.com) via the Indeed12 RapidAPI scraper. Trusted as German-firm
    // signal by source — no extra filter.
    tasks.push(
      fetchIndeedDe().catch((e) => {
        console.error("[indeed-de]", e);
        return [];
      }),
    );
  }
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    tasks.push(
      fetchAdzuna({
        roleKeywords,
        location: locations[0] ?? "",
        salaryMin: prefs.salaryMin,
        remote,
      }).catch((e) => {
        console.error("[adzuna]", e);
        return [];
      }),
    );
  }
  const results = await Promise.all(tasks);
  return results.flat();
}
