import type { Profile } from "@prisma/client";
import type { Preferences, VoiceNote } from "@/lib/types";

// Build a condensed profile string suitable for prompt-caching in Claude calls.
// Keep <8k tokens — pull only the most relevant fields.
export function buildProfileBlob(profile: Profile | null): string {
  if (!profile) return "(No profile available.)";
  const lines: string[] = [];

  if (profile.linkedinJson) {
    const li = profile.linkedinJson as Record<string, unknown>;
    const headline = (li.headline as string) ?? "";
    const summary = (li.summary as string) ?? "";
    const positions = (li.positions as Array<Record<string, unknown>>) ?? [];
    const skills = (li.skills as string[]) ?? [];
    const education = (li.education as Array<Record<string, unknown>>) ?? [];

    if (headline) lines.push(`Headline: ${headline}`);
    if (summary) lines.push(`Summary: ${summary}`);
    if (positions.length) {
      lines.push("Experience:");
      for (const p of positions.slice(0, 10)) {
        lines.push(
          `  - ${p.title ?? ""} at ${p.companyName ?? ""} (${p.startedOn ?? ""} - ${p.finishedOn ?? "present"}): ${p.description ?? ""}`.slice(
            0,
            500,
          ),
        );
      }
    }
    if (education.length) {
      lines.push("Education:");
      for (const e of education.slice(0, 5)) {
        lines.push(`  - ${e.schoolName ?? ""}: ${e.degreeName ?? ""} ${e.fieldOfStudy ?? ""}`);
      }
    }
    if (skills.length) lines.push(`Skills (LinkedIn): ${skills.slice(0, 50).join(", ")}`);
  }

  if (profile.cvText) {
    lines.push("\nCV text (truncated):");
    lines.push(profile.cvText.slice(0, 4000));
  }

  const notes = profile.voiceNotes as VoiceNote[];
  if (Array.isArray(notes) && notes.length) {
    lines.push("\nVoice-note context (most recent first):");
    for (const n of [...notes].reverse().slice(0, 10)) {
      lines.push(`  - ${n.transcript}`.slice(0, 400));
    }
  }

  return lines.join("\n");
}

export function readPreferences(profile: Profile | null): Preferences {
  return (profile?.preferences as Preferences) ?? {};
}
