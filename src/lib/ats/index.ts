import type { Company } from "@prisma/client";
import type { RawPosting } from "@/lib/types";
import { fetchGreenhouse } from "./greenhouse";
import { fetchLever } from "./lever";
import { fetchAshby } from "./ashby";
import { fetchWorkday } from "./workday";
import { fetchGeneric } from "./generic";

export async function fetchCompanyJobs(company: Company): Promise<RawPosting[]> {
  switch (company.atsType) {
    case "greenhouse": return fetchGreenhouse(company);
    case "lever":      return fetchLever(company);
    case "ashby":      return fetchAshby(company);
    case "workday":    return fetchWorkday(company);
    case "generic_html": return fetchGeneric(company);
    case "unknown":
    default:
      throw new Error(`No ATS detected for ${company.name}`);
  }
}

export { detectAtsFromUrl, discoverCareersPage } from "./detect";
