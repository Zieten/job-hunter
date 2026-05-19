import AdmZip from "adm-zip";

// LinkedIn data export ships a ZIP with multiple CSV files. We parse only the most useful ones.

type LinkedInProfile = {
  headline?: string;
  summary?: string;
  firstName?: string;
  lastName?: string;
  location?: string;
  positions?: Array<{
    title: string;
    companyName: string;
    description?: string;
    location?: string;
    startedOn?: string;
    finishedOn?: string;
  }>;
  education?: Array<{
    schoolName: string;
    degreeName?: string;
    fieldOfStudy?: string;
    startedOn?: string;
    finishedOn?: string;
  }>;
  skills?: string[];
};

export function parseLinkedInZip(buf: Buffer): LinkedInProfile {
  const zip = new AdmZip(buf);
  const entries = zip.getEntries();
  const get = (name: string): string | null => {
    const entry = entries.find((e) => e.entryName.toLowerCase().endsWith(name.toLowerCase()));
    return entry ? entry.getData().toString("utf8") : null;
  };

  const profile: LinkedInProfile = {};

  // Profile.csv: a single-row CSV with First Name, Last Name, Headline, Summary, Industry, Geo Location, etc.
  const profileCsv = get("Profile.csv");
  if (profileCsv) {
    const rows = parseCsv(profileCsv);
    if (rows.length >= 2) {
      const obj = zipRow(rows[0], rows[1]);
      profile.firstName = obj["First Name"];
      profile.lastName = obj["Last Name"];
      profile.headline = obj["Headline"];
      profile.summary = obj["Summary"];
      profile.location = obj["Geo Location"];
    }
  }

  // Positions.csv: company, title, description, location, started on, finished on
  const posCsv = get("Positions.csv");
  if (posCsv) {
    const rows = parseCsv(posCsv);
    const [header, ...data] = rows;
    if (header) {
      profile.positions = data.map((r) => {
        const o = zipRow(header, r);
        return {
          title: o["Title"] ?? "",
          companyName: o["Company Name"] ?? "",
          description: o["Description"] ?? undefined,
          location: o["Location"] ?? undefined,
          startedOn: o["Started On"] ?? undefined,
          finishedOn: o["Finished On"] ?? undefined,
        };
      }).filter((p) => p.title || p.companyName);
    }
  }

  // Education.csv
  const eduCsv = get("Education.csv");
  if (eduCsv) {
    const rows = parseCsv(eduCsv);
    const [header, ...data] = rows;
    if (header) {
      profile.education = data.map((r) => {
        const o = zipRow(header, r);
        return {
          schoolName: o["School Name"] ?? "",
          degreeName: o["Degree Name"] ?? undefined,
          fieldOfStudy: o["Field Of Study"] ?? undefined,
          startedOn: o["Start Date"] ?? undefined,
          finishedOn: o["End Date"] ?? undefined,
        };
      }).filter((e) => e.schoolName);
    }
  }

  // Skills.csv: just one column "Name"
  const skillsCsv = get("Skills.csv");
  if (skillsCsv) {
    const rows = parseCsv(skillsCsv);
    profile.skills = rows.slice(1).map((r) => r[0]).filter(Boolean);
  }

  return profile;
}

// Minimal RFC4180-ish CSV parser (handles quoted fields with commas/newlines/embedded quotes).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (ch === "\r") {
        // ignore
      } else {
        field += ch;
      }
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function zipRow(headers: string[], values: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((h, i) => {
    out[h] = values[i] ?? "";
  });
  return out;
}
