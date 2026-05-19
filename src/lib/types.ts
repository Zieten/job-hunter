// Shared domain types used across adapters and AI calls.

export type RawPosting = {
  externalId: string;
  title: string;
  location: string | null;
  remote: boolean;
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  url: string;
  descriptionMd: string;
  postedAt: Date | null;
};

export type AggregatorPosting = RawPosting & {
  companyNameRaw: string;
  source:
    | "aggregator_jsearch"
    | "aggregator_adzuna"
    | "aggregator_german_us"
    | "aggregator_indeed_de";
};

export type SeniorityLevel =
  | "intern"
  | "junior"
  | "mid"
  | "senior"
  | "staff"
  | "principal"
  | "director"
  | "vp"
  | "c_level";

export const SENIORITY_LEVELS: { value: SeniorityLevel; label: string }[] = [
  { value: "intern", label: "Intern" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "staff", label: "Staff" },
  { value: "principal", label: "Principal" },
  { value: "director", label: "Director" },
  { value: "vp", label: "VP" },
  { value: "c_level", label: "C-level" },
];

export type Preferences = {
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  locations?: string[];
  remote?: boolean;
  roleKeywords?: string[];
  dealbreakers?: string[];
  mustHaves?: string[];
  seniority?: SeniorityLevel[];
};

export type VoiceNote = {
  id: string;
  transcript: string;
  createdAt: string; // ISO
  tags: string[];
};

export type FitOutput = {
  fitScore: number;
  interviewProbability: number;
  strengths: string[];
  gaps: string[];
  reasoning: string;
};

export type TailoredCVStructure = {
  fullName: string;
  headline: string;
  contact: { email?: string; phone?: string; location?: string; linkedin?: string; website?: string };
  summary: string;
  skills: { category: string; items: string[] }[];
  experience: {
    company: string;
    role: string;
    start: string;
    end: string | null;
    location?: string;
    bullets: string[];
  }[];
  education: { school: string; degree: string; start?: string; end?: string }[];
  projects?: { name: string; description: string; tech?: string[] }[];
};
