"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  onTranscribed?: (transcript: string) => void;
};

export function VoiceRecorder({ onTranscribed }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: pickMime() });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        await upload(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setState("recording");
    } catch {
      toast.error("Microphone permission denied");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setState("processing");
  }

  async function upload(blob: Blob) {
    const form = new FormData();
    form.append("audio", new File([blob], `voice-${Date.now()}.webm`, { type: blob.type }));
    try {
      const res = await fetch("/api/voice", { method: "POST", body: form });
      const data = (await res.json()) as { transcript: string };
      if (res.ok) {
        onTranscribed?.(data.transcript);
        toast.success("Voice note saved");
      } else {
        toast.error("Transcription failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setState("idle");
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.button
        onClick={state === "recording" ? stop : state === "idle" ? start : undefined}
        whileTap={{ scale: 0.95 }}
        animate={state === "recording" ? { boxShadow: ["0 0 0 0 rgba(239,84,84,0.4)", "0 0 0 20px rgba(239,84,84,0)"] } : {}}
        transition={state === "recording" ? { duration: 1.4, repeat: Infinity } : {}}
        className="size-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
        disabled={state === "processing"}
        aria-label={state === "recording" ? "Stop recording" : "Start recording"}
      >
        <AnimatePresence mode="wait">
          {state === "recording" ? (
            <motion.span key="stop" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Square className="size-7 fill-current" />
            </motion.span>
          ) : state === "processing" ? (
            <motion.span key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Loader2 className="size-7 animate-spin" />
            </motion.span>
          ) : (
            <motion.span key="mic" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Mic className="size-7" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <p className="text-xs text-muted-foreground">
        {state === "recording" ? "Tap to stop" : state === "processing" ? "Transcribing..." : "Tap to record a note"}
      </p>
    </div>
  );
}

function pickMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* ignore */
    }
  }
  return "audio/webm";
}
