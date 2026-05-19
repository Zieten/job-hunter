import { claude, extractJson, MODEL_PRIMARY } from "./claude";
import type { TailoredCVStructure } from "@/lib/types";

type TailorInput = {
  profileBlob: string;
  posting: {
    company: string;
    title: string;
    location: string | null;
    descriptionMd: string;
  };
};

const SYSTEM = `You are an expert CV writer focused on ATS-parseable, role-tailored CVs.
Produce a strictly structured JSON CV via the provided tool. Rules:
- Reorder skills and reword experience bullets to emphasize the most relevant items for the target role first.
- Never invent experience, employers, dates, or credentials that aren't in the candidate's profile.
- Bullets must start with a strong verb, include impact + metric when available, and stay under 28 words.
- Summary is 2-3 sentences, third-person-omniscient, no first-person pronouns.
- Keep total experience bullets ~3-5 per role.`;

const TOOL = {
  name: "render_tailored_cv",
  description: "Render the candidate's CV tailored for the specified posting.",
  input_schema: {
    type: "object" as const,
    properties: {
      fullName: { type: "string" },
      headline: { type: "string" },
      contact: {
        type: "object",
        properties: {
          email: { type: "string" },
          phone: { type: "string" },
          location: { type: "string" },
          linkedin: { type: "string" },
          website: { type: "string" },
        },
      },
      summary: { type: "string" },
      skills: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string" },
            items: { type: "array", items: { type: "string" } },
          },
          required: ["category", "items"],
        },
      },
      experience: {
        type: "array",
        items: {
          type: "object",
          properties: {
            company: { type: "string" },
            role: { type: "string" },
            start: { type: "string" },
            end: { type: ["string", "null"] },
            location: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
          required: ["company", "role", "start", "end", "bullets"],
        },
      },
      education: {
        type: "array",
        items: {
          type: "object",
          properties: {
            school: { type: "string" },
            degree: { type: "string" },
            start: { type: "string" },
            end: { type: "string" },
          },
          required: ["school", "degree"],
        },
      },
      projects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            tech: { type: "array", items: { type: "string" } },
          },
          required: ["name", "description"],
        },
      },
    },
    required: ["fullName", "headline", "contact", "summary", "skills", "experience", "education"],
  },
};

export async function tailorCV(input: TailorInput): Promise<TailoredCVStructure> {
  const res = await claude().messages.create({
    model: MODEL_PRIMARY,
    max_tokens: 3500,
    system: [
      { type: "text", text: SYSTEM },
      {
        type: "text",
        text: `Candidate profile (source of truth — do not invent beyond this):\n${input.profileBlob}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [
      {
        role: "user",
        content: `Target posting:\n\nCompany: ${input.posting.company}\nTitle: ${input.posting.title}\nLocation: ${input.posting.location ?? ""}\n\nJob description:\n${input.posting.descriptionMd.slice(0, 10000)}\n\nProduce the tailored CV now.`,
      },
    ],
  });
  return extractJson<TailoredCVStructure>(res);
}
