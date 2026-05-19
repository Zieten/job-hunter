import { claude, extractJson, MODEL_PRIMARY } from "./claude";
import type { FitOutput, Preferences } from "@/lib/types";
import { HARDCODED_PREFS_PROMPT } from "@/lib/profile-hardcoded";

type FitInput = {
  profileBlob: string;     // condensed profile (LinkedIn + CV + voice notes summary)
  preferences: Preferences;
  posting: {
    company: string;
    title: string;
    location: string | null;
    salaryText: string | null;
    descriptionMd: string;
    source?: string;
  };
};

const SYSTEM = `You are a senior recruiter assessing fit between a candidate and a job posting.
You produce strictly structured JSON output via the provided tool. Be honest and calibrated — most fits are 40-70.
Reserve 80+ for postings where the candidate is genuinely strong across required skills AND seniority AND the hardcoded profile constraints (comp, location, dealbreakers, target functions).
Subtract from the score for any dealbreaker hit. Penalize hard if salary, location, seniority, or function clearly mismatches the hardcoded profile.
For German-firm postings (source aggregator_german_us or aggregator_indeed_de): apply a +15 fit boost AND ignore strict role/seniority/comp filters (comp is often non-public for first-US-hire roles). Treat German-language fluency as a strength.`;

const TOOL = {
  name: "record_fit_assessment",
  description: "Record a structured fit assessment for the candidate against this job posting.",
  input_schema: {
    type: "object" as const,
    properties: {
      fitScore: { type: "number", minimum: 0, maximum: 100, description: "Overall fit 0-100" },
      interviewProbability: { type: "number", minimum: 0, maximum: 100, description: "Estimated probability the candidate would land a first-round interview if they applied" },
      strengths: { type: "array", items: { type: "string" }, maxItems: 6 },
      gaps: { type: "array", items: { type: "string" }, maxItems: 6 },
      reasoning: { type: "string", description: "2-4 sentences" },
    },
    required: ["fitScore", "interviewProbability", "strengths", "gaps", "reasoning"],
  },
};

export async function scoreFit(input: FitInput): Promise<FitOutput> {
  const res = await claude().messages.create({
    model: MODEL_PRIMARY,
    max_tokens: 1024,
    system: [
      { type: "text", text: SYSTEM },
      {
        // Prompt cache the (rarely-changing) profile + hardcoded preferences.
        type: "text",
        text: `${HARDCODED_PREFS_PROMPT}\n\nCandidate profile:\n${input.profileBlob}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [
      {
        role: "user",
        content: `Assess fit for this posting:\n\nCompany: ${input.posting.company}\nTitle: ${input.posting.title}\nLocation: ${input.posting.location ?? "(unspecified)"}\nSalary: ${input.posting.salaryText ?? "(unspecified)"}\n\nDescription:\n${input.posting.descriptionMd.slice(0, 8000)}`,
      },
    ],
  });
  return extractJson<FitOutput>(res);
}
