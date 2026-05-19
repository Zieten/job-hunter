"use client";
import { useState } from "react";
import type { Profile } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, FileText, UserSquare2 } from "lucide-react";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { toast } from "sonner";
import type { VoiceNote } from "@/lib/types";

type Props = { profile: Profile | null; userEmail: string };

export function ProfileUI({ profile: initial, userEmail }: Props) {
  const [profile, setProfile] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function upload(field: "linkedin" | "cv", file: File) {
    setBusy(true);
    const form = new FormData();
    form.append(field, file);
    try {
      const res = await fetch("/api/profile/import", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast.success(`${field === "linkedin" ? "LinkedIn data" : "CV"} imported`);
      location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const linkedinSummary = profile?.linkedinJson as
    | { firstName?: string; lastName?: string; headline?: string; positions?: unknown[]; skills?: string[] }
    | undefined;
  const cvLength = profile?.cvText?.length ?? 0;
  const notes = (profile?.voiceNotes as VoiceNote[]) ?? [];

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <UserSquare2 className="size-5 text-primary" />
          <h2 className="font-semibold">LinkedIn export</h2>
        </div>
        {linkedinSummary ? (
          <div className="text-sm space-y-1">
            <p className="font-medium">
              {linkedinSummary.firstName} {linkedinSummary.lastName}
            </p>
            <p className="text-muted-foreground">{linkedinSummary.headline}</p>
            <p className="text-xs text-muted-foreground">
              {(linkedinSummary.positions?.length ?? 0)} positions • {(linkedinSummary.skills?.length ?? 0)} skills
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-3">
            Upload the .zip you got from LinkedIn → Settings → Data Privacy → Get a copy of your data.
          </p>
        )}
        <label className="inline-flex items-center gap-2 mt-3 cursor-pointer text-sm font-medium text-primary hover:underline">
          <Upload className="size-4" /> {linkedinSummary ? "Replace" : "Upload"} ZIP
          <input
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload("linkedin", e.target.files[0])}
            disabled={busy}
          />
        </label>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="size-5 text-primary" />
          <h2 className="font-semibold">Current CV</h2>
        </div>
        {cvLength > 0 ? (
          <p className="text-sm text-muted-foreground">{cvLength.toLocaleString()} characters parsed.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Upload your PDF or DOCX CV so the AI can use it as a baseline.</p>
        )}
        <label className="inline-flex items-center gap-2 mt-3 cursor-pointer text-sm font-medium text-primary hover:underline">
          <Upload className="size-4" /> {cvLength > 0 ? "Replace" : "Upload"} CV
          <input
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload("cv", e.target.files[0])}
            disabled={busy}
          />
        </label>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold mb-3">Voice notes</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Add context the AI should weigh: salary expectations, location nuance, soft preferences. Whisper transcribes; Claude extracts structured preferences.
        </p>
        <VoiceRecorder />
        {notes.length > 0 && (
          <ul className="mt-6 space-y-3 text-sm">
            {[...notes].reverse().slice(0, 10).map((n) => (
              <li key={n.id} className="rounded-lg border bg-muted/30 p-3">
                <p className="whitespace-pre-wrap">{n.transcript}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Signed in as {userEmail}</p>
    </div>
  );
}
