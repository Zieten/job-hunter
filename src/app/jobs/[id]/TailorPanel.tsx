"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Download, ExternalLink, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import type { TailoredCV } from "@prisma/client";

type Props = {
  jobId: string;
  initialCV: TailoredCV | null;
  applyUrl: string;
};

export function TailorPanel({ jobId, initialCV, applyUrl }: Props) {
  const [cv, setCv] = useState<TailoredCV | null>(initialCV);
  const [loading, setLoading] = useState(false);

  async function tailor() {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/tailor`, { method: "POST" });
      const data = (await res.json()) as { tailoredCV: TailoredCV };
      if (!res.ok) throw new Error("Tailor failed");
      setCv(data.tailoredCV);
      toast.success("Tailored CV is ready");
    } catch {
      toast.error("Tailoring failed");
    } finally {
      setLoading(false);
    }
  }

  async function applyClick() {
    if (cv?.pdfBlobUrl) {
      try {
        await navigator.clipboard.writeText(cv.pdfBlobUrl);
        toast.success("CV link copied — opening apply page");
      } catch {
        /* ignore */
      }
    }
    window.open(applyUrl, "_blank", "noopener");
  }

  return (
    <div className="sticky bottom-20 sm:bottom-4 z-10">
      <div className="rounded-2xl border bg-card/95 backdrop-blur shadow-lg p-4 sm:p-5 space-y-3">
        {cv ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="size-4 text-primary" />
              <span className="font-medium">Tailored CV v{cv.version}</span>
              <span className="text-muted-foreground">— ready to use</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {cv.pdfBlobUrl && (
                <Button asChild variant="outline" size="sm">
                  <a href={cv.pdfBlobUrl} target="_blank" rel="noopener" download>
                    <Download className="size-4" /> PDF
                  </a>
                </Button>
              )}
              {cv.docxBlobUrl && (
                <Button asChild variant="outline" size="sm">
                  <a href={cv.docxBlobUrl} target="_blank" rel="noopener" download>
                    <Download className="size-4" /> DOCX
                  </a>
                </Button>
              )}
              <Button onClick={tailor} variant="ghost" size="sm" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Retailor
              </Button>
              <Button onClick={applyClick} size="sm" className="ml-auto">
                Open & apply <ExternalLink className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={tailor} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Tailor my CV for this role
            </Button>
            <Button onClick={applyClick} variant="outline">
              Open posting <ExternalLink className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
