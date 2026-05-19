import type { AtsType } from "@prisma/client";

export type AtsDetection = {
  type: AtsType;
  slug?: string;
  tenant?: string;
  host?: string;
  site?: string;
};

const UA = "Mozilla/5.0 (compatible; JobHunterBot/1.0; +https://github.com/jobhunter)";

export function detectAtsFromUrl(careersUrl: string): AtsDetection | null {
  try {
    const u = new URL(careersUrl);
    const host = u.hostname.toLowerCase();
    const path = u.pathname;

    // boards.greenhouse.io/<slug>
    if (host === "boards.greenhouse.io" || host.endsWith(".greenhouse.io")) {
      const slug = path.split("/").filter(Boolean)[0];
      if (slug) return { type: "greenhouse", slug };
    }
    // jobs.lever.co/<slug>
    if (host === "jobs.lever.co" || host === "api.lever.co") {
      const slug = path.split("/").filter(Boolean)[0];
      if (slug) return { type: "lever", slug };
    }
    // jobs.ashbyhq.com/<slug>
    if (host === "jobs.ashbyhq.com" || host.endsWith(".ashbyhq.com")) {
      const slug = path.split("/").filter(Boolean)[0];
      if (slug) return { type: "ashby", slug };
    }
    // <tenant>.<wd-host>.myworkdayjobs.com/<site>
    const wdMatch = host.match(/^([\w-]+)\.(wd\d+)\.myworkdayjobs\.com$/);
    if (wdMatch) {
      const site = path.split("/").filter(Boolean)[0];
      return { type: "workday", tenant: wdMatch[1], host: wdMatch[2], site: site || "External" };
    }
    return { type: "generic_html" };
  } catch {
    return null;
  }
}

// Probe the actual ATS API endpoint (not the frontend SPA) to confirm a company is really on that ATS.
// Ashby's SPA returns 200 for any slug, so probing the frontend URL gives false positives.
const ATS_API_PROBE: Record<string, (slug: string) => string> = {
  greenhouse: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
  lever: (slug) => `https://api.lever.co/v0/postings/${slug}`,
  ashby: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
};

// Try to discover a company's careers page (and ATS) from just its name.
export async function discoverCareersPage(companyName: string): Promise<{ url: string; detection: AtsDetection } | null> {
  const slugGuesses = slugify(companyName);
  for (const slug of slugGuesses) {
    const checks: { probeUrl: string; careersUrl: string; detection: AtsDetection }[] = [
      {
        probeUrl: ATS_API_PROBE.greenhouse(slug),
        careersUrl: `https://boards.greenhouse.io/${slug}`,
        detection: { type: "greenhouse", slug },
      },
      {
        probeUrl: ATS_API_PROBE.lever(slug),
        careersUrl: `https://jobs.lever.co/${slug}`,
        detection: { type: "lever", slug },
      },
      {
        probeUrl: ATS_API_PROBE.ashby(slug),
        careersUrl: `https://jobs.ashbyhq.com/${slug}`,
        detection: { type: "ashby", slug },
      },
    ];
    for (const c of checks) {
      if (await pageExists(c.probeUrl)) return { url: c.careersUrl, detection: c.detection };
    }
  }
  return null;
}

function slugify(name: string): string[] {
  const base = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9\s-]/g, "").trim();
  const slug = base.replace(/\s+/g, "");
  const hyphen = base.replace(/\s+/g, "-");
  return Array.from(new Set([slug, hyphen].filter(Boolean)));
}

async function pageExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
