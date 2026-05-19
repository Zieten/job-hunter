import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { tailorCV } from "@/lib/ai/tailor";
import { renderCVtoPdf } from "@/lib/cv/render-pdf";
import { renderCVtoDocx } from "@/lib/cv/render-docx";
import { buildProfileBlob } from "@/lib/profile-blob";
import { put } from "@vercel/blob";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const job = await db.jobPosting.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  const profile = await db.profile.findUnique({ where: { userId: session.user.id } });
  const profileBlob = buildProfileBlob(profile);

  const cv = await tailorCV({
    profileBlob,
    posting: {
      company: job.company.name,
      title: job.title,
      location: job.location,
      descriptionMd: job.descriptionMd,
    },
  });

  let pdfBlobUrl: string | null = null;
  let docxBlobUrl: string | null = null;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const [pdfBuf, docxBuf] = await Promise.all([renderCVtoPdf(cv), renderCVtoDocx(cv)]);
    const stamp = Date.now();
    const safeName = `${cv.fullName.replace(/\s+/g, "_")}-${slugify(job.company.name)}-${slugify(job.title)}`;
    const [pdfUp, docxUp] = await Promise.all([
      put(`cvs/${stamp}-${safeName}.pdf`, pdfBuf, {
        access: "public",
        contentType: "application/pdf",
      }),
      put(`cvs/${stamp}-${safeName}.docx`, docxBuf, {
        access: "public",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ]);
    pdfBlobUrl = pdfUp.url;
    docxBlobUrl = docxUp.url;
  }

  const latest = await db.tailoredCV.findFirst({
    where: { jobPostingId: job.id },
    orderBy: { version: "desc" },
  });
  const version = (latest?.version ?? 0) + 1;

  const saved = await db.tailoredCV.create({
    data: {
      jobPostingId: job.id,
      version,
      markdownSource: "",
      jsonStructure: cv as unknown as Prisma.InputJsonValue,
      pdfBlobUrl,
      docxBlobUrl,
      modelUsed: "claude-sonnet-4-6",
    },
  });

  return NextResponse.json({ tailoredCV: saved, structure: cv });
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}
