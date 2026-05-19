import { NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { VoiceNote, Preferences } from "@/lib/types";
import { claude, extractJson, MODEL_FAST } from "@/lib/ai/claude";

export const runtime = "nodejs";

let _openai: OpenAI | null = null;
function openai() {
  if (_openai) return _openai;
  _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const audio = form.get("audio") as File | null;
  if (!audio) return NextResponse.json({ error: "audio field required" }, { status: 400 });

  // Whisper transcription
  const tr = await openai().audio.transcriptions.create({
    file: audio,
    model: "whisper-1",
  });
  const transcript = tr.text;

  // Extract structured preferences via Claude (Haiku for speed/cost)
  const profile = await db.profile.findUnique({ where: { userId: session.user.id } });
  const existing = (profile?.preferences as Preferences) ?? {};
  const merged = await extractPreferences(transcript, existing);

  const newNote: VoiceNote = {
    id: crypto.randomUUID(),
    transcript,
    createdAt: new Date().toISOString(),
    tags: [],
  };
  const updatedNotes = [...((profile?.voiceNotes as VoiceNote[]) ?? []), newNote];

  await db.profile.upsert({
    where: { userId: session.user.id },
    update: {
      voiceNotes: updatedNotes as unknown as Prisma.InputJsonValue,
      preferences: merged as unknown as Prisma.InputJsonValue,
    },
    create: {
      userId: session.user.id,
      voiceNotes: updatedNotes as unknown as Prisma.InputJsonValue,
      preferences: merged as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ transcript, preferences: merged });
}

async function extractPreferences(transcript: string, existing: Preferences): Promise<Preferences> {
  const TOOL = {
    name: "merge_preferences",
    description: "Update the candidate's job-search preferences based on the voice note. Only set fields that the note speaks to. Keep existing values when not contradicted.",
    input_schema: {
      type: "object" as const,
      properties: {
        salaryMin: { type: "number" },
        salaryMax: { type: "number" },
        currency: { type: "string" },
        locations: { type: "array", items: { type: "string" } },
        remote: { type: "boolean" },
        roleKeywords: { type: "array", items: { type: "string" } },
        dealbreakers: { type: "array", items: { type: "string" } },
        mustHaves: { type: "array", items: { type: "string" } },
        seniority: {
          type: "array",
          items: { type: "string", enum: ["intern", "junior", "mid", "senior", "staff", "principal", "director", "vp", "c_level"] },
        },
      },
    },
  };
  const res = await claude().messages.create({
    model: MODEL_FAST,
    max_tokens: 600,
    system: "You merge a voice note's job-search preferences with the candidate's existing preferences. Return the FULL merged preferences object.",
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [
      {
        role: "user",
        content: `Existing preferences:\n${JSON.stringify(existing, null, 2)}\n\nNew voice note:\n${transcript}\n\nReturn the merged preferences.`,
      },
    ],
  });
  try {
    return extractJson<Preferences>(res);
  } catch {
    return existing;
  }
}
