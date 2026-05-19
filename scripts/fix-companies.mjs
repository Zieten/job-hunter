/**
 * One-time script to fix incorrectly detected ATS settings for known companies.
 *
 * Run from anywhere:
 *   node scripts/fix-companies.mjs
 *
 * (The script resolves .env.local relative to its own location, so CWD doesn't matter.)
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Resolve .env.local relative to this script file, not CWD
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "..", ".env.local");
try {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
  console.log(`Loaded env from ${envPath}\n`);
} catch {
  console.warn("Could not load .env.local — Prisma will use its own env resolution\n");
}

function normalizeCompanyName(raw) {
  return raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.,'"()]/g, "")
    .replace(/\b(inc|incorporated|ltd|limited|llc|gmbh|sa|ag|plc|corp|corporation|co)\b\.?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const FIXES = [
  // ── Workday ──────────────────────────────────────────────────────────────────
  {
    normalizedName: "accenture",
    displayName: "Accenture",
    careersUrl: "https://accenture.wd103.myworkdayjobs.com/AccentureCareers",
    atsType: "workday", atsSlug: null,
    atsTenant: "accenture", atsHost: "wd103", atsSite: "AccentureCareers",
  },
  {
    normalizedName: "bill and melinda gates foundation",
    displayName: "Bill & Melinda Gates Foundation",
    careersUrl: "https://gatesfoundation.wd1.myworkdayjobs.com/Gates",
    atsType: "workday", atsSlug: null,
    atsTenant: "gatesfoundation", atsHost: "wd1", atsSite: "Gates",
  },
  {
    normalizedName: "boeing",
    displayName: "Boeing",
    careersUrl: "https://boeing.wd1.myworkdayjobs.com/EXTERNAL_CAREERS",
    atsType: "workday", atsSlug: null,
    atsTenant: "boeing", atsHost: "wd1", atsSite: "EXTERNAL_CAREERS",
  },
  {
    normalizedName: "nordstrom",
    displayName: "Nordstrom",
    careersUrl: "https://nordstrom.wd501.myworkdayjobs.com/nordstrom_careers",
    atsType: "workday", atsSlug: null,
    atsTenant: "nordstrom", atsHost: "wd501", atsSite: "nordstrom_careers",
  },
  {
    normalizedName: "salesforce",
    displayName: "Salesforce",
    careersUrl: "https://salesforce.wd12.myworkdayjobs.com/External_Career_Site",
    atsType: "workday", atsSlug: null,
    atsTenant: "salesforce", atsHost: "wd12", atsSite: "External_Career_Site",
  },
  {
    // Stored as "PWC" (all caps) by Ben
    normalizedName: "pwc",
    displayName: "PwC",
    careersUrl: "https://pwc.wd3.myworkdayjobs.com/Global_Experienced_Careers",
    atsType: "workday", atsSlug: null,
    atsTenant: "pwc", atsHost: "wd3", atsSite: "Global_Experienced_Careers",
  },
  {
    normalizedName: "equinix",
    displayName: "Equinix",
    careersUrl: "https://equinix.wd1.myworkdayjobs.com/External",
    atsType: "workday", atsSlug: null,
    atsTenant: "equinix", atsHost: "wd1", atsSite: "External",
  },
  // ── Greenhouse ───────────────────────────────────────────────────────────────
  {
    normalizedName: "helion energy",
    displayName: "Helion Energy",
    careersUrl: "https://boards.greenhouse.io/helionenergy",
    atsType: "greenhouse", atsSlug: "helionenergy",
    atsTenant: null, atsHost: null, atsSite: null,
  },
  {
    normalizedName: "group14 technologies",
    displayName: "Group14 Technologies",
    careersUrl: "https://boards.greenhouse.io/group14",
    atsType: "greenhouse", atsSlug: "group14",
    atsTenant: null, atsHost: null, atsSite: null,
  },
  {
    // Stored as "Terra Power" (two words)
    normalizedName: "terra power",
    displayName: "TerraPower",
    careersUrl: "https://boards.greenhouse.io/terrapowerllc",
    atsType: "greenhouse", atsSlug: "terrapowerllc",
    atsTenant: null, atsHost: null, atsSite: null,
  },
  // ── Lever ────────────────────────────────────────────────────────────────────
  {
    // Veilance jobs are posted under Arc'teryx's Lever account
    normalizedName: "veilance",
    displayName: "Veilance",
    careersUrl: "https://jobs.lever.co/arcteryx.com",
    atsType: "lever", atsSlug: "arcteryx.com",
    atsTenant: null, atsHost: null, atsSite: null,
  },
  // ── Generic HTML (SmartRecruiters / SuccessFactors / BrassRing / custom) ─────
  {
    normalizedName: "bain and company",
    displayName: "Bain & Company",
    careersUrl: "https://careers.bain.com/jobs",
    atsType: "generic_html", atsSlug: null,
    atsTenant: null, atsHost: null, atsSite: null,
  },
  {
    // Covers "Boston Consulting" and "Boston Consulting Group"
    normalizedName: "boston consulting",
    displayName: "Boston Consulting Group",
    careersUrl: "https://careers.bcg.com/global/en/search-results",
    atsType: "generic_html", atsSlug: null,
    atsTenant: null, atsHost: null, atsSite: null,
  },
  {
    normalizedName: "deloitte",
    displayName: "Deloitte",
    careersUrl: "https://apply.deloitte.com/",
    atsType: "generic_html", atsSlug: null,
    atsTenant: null, atsHost: null, atsSite: null,
  },
  {
    normalizedName: "digital realty",
    displayName: "Digital Realty",
    careersUrl: "https://careers.digitalrealty.com/",
    atsType: "generic_html", atsSlug: null,
    atsTenant: null, atsHost: null, atsSite: null,
  },
  {
    normalizedName: "ey",
    displayName: "EY",
    careersUrl: "https://careers.ey.com/",
    atsType: "generic_html", atsSlug: null,
    atsTenant: null, atsHost: null, atsSite: null,
  },
  {
    normalizedName: "microsoft",
    displayName: "Microsoft",
    careersUrl: "https://careers.microsoft.com/",
    atsType: "generic_html", atsSlug: null,
    atsTenant: null, atsHost: null, atsSite: null,
  },
  {
    normalizedName: "servicenow",
    displayName: "ServiceNow",
    careersUrl: "https://careers.smartrecruiters.com/servicenow",
    atsType: "generic_html", atsSlug: null,
    atsTenant: null, atsHost: null, atsSite: null,
  },
  {
    normalizedName: "mckinsey",
    displayName: "McKinsey",
    careersUrl: "https://www.mckinsey.com/careers/search-jobs",
    atsType: "generic_html", atsSlug: null,
    atsTenant: null, atsHost: null, atsSite: null,
  },
  {
    normalizedName: "rei",
    displayName: "REI",
    careersUrl: "https://www.rei.jobs/jobs",
    atsType: "generic_html", atsSlug: null,
    atsTenant: null, atsHost: null, atsSite: null,
  },
];

async function main() {
  const db = new PrismaClient();
  try {
    console.log("Loading companies from DB...");
    const all = await db.company.findMany({ where: { isFavorite: true } });
    console.log(`Found ${all.length} favorite companies.\n`);

    let fixed = 0;
    for (const fix of FIXES) {
      const match = all.find((c) => {
        const cn = normalizeCompanyName(c.name);
        return cn === fix.normalizedName || cn.startsWith(fix.normalizedName);
      });

      if (!match) {
        console.log(`  SKIP  — not in DB: ${fix.displayName}`);
        continue;
      }

      await db.company.update({
        where: { id: match.id },
        data: {
          careersUrl: fix.careersUrl,
          atsType: fix.atsType,
          atsSlug: fix.atsSlug,
          atsTenant: fix.atsTenant,
          atsHost: fix.atsHost,
          atsSite: fix.atsSite,
          lastError: null,
        },
      });

      console.log(`  FIXED — ${match.name} → ${fix.atsType}`);
      console.log(`          ${fix.careersUrl}`);
      fixed++;
    }

    console.log(`\nDone. ${fixed} companies updated. Refresh /companies to see updated badges.`);
    console.log("Run a scan to pick up jobs from the corrected ATS entries:");
    console.log('  curl.exe "http://localhost:3000/api/cron/scan?force=1"');
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
