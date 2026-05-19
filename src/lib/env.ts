import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  APP_PASSWORD: z.string().min(1),
  APP_USER_EMAIL: z.string().email().optional().default("owner@local"),
  ANTHROPIC_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  RAPIDAPI_KEY: z.string().optional().default(""),
  ADZUNA_APP_ID: z.string().optional().default(""),
  ADZUNA_APP_KEY: z.string().optional().default(""),
  ADZUNA_COUNTRY: z.string().optional().default("us"),
  BLOB_READ_WRITE_TOKEN: z.string().optional().default(""),
  CRON_SECRET: z.string().min(1),
  APP_TIMEZONE: z.string().optional().default("America/Los_Angeles"),
  NEXTAUTH_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const missing = Object.entries(flat)
      .map(([k, v]) => `  ${k}: ${v?.join(", ")}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${missing}`);
  }
  cached = parsed.data;
  return cached;
}
