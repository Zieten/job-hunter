import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { parseLinkedInZip } from "@/lib/linkedin/parse";
import { extractCvText } from "@/lib/cv/extract";
import { put } from "@vercel/blob";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const linkedinFile = form.get("linkedin") as File | null;
    const cvFile = form.get("cv") as File | null;
    const preferencesRaw = form.get("preferences");
    const preferences = typeof preferencesRaw === "string" ? JSON.parse(preferencesRaw) : undefined;

    const data: Prisma.ProfileUpsertArgs["update"] = {};
    const create: Prisma.ProfileUpsertArgs["create"] = { userId: session.user.id };

    if (linkedinFile) {
      try {
        const buf = Buffer.from(await linkedinFile.arrayBuffer());
        const parsed = parseLinkedInZip(buf);
        data.linkedinJson = parsed as unknown as Prisma.InputJsonValue;
        create.linkedinJson = parsed as unknown as Prisma.InputJsonValue;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: `LinkedIn ZIP parse failed: ${msg}` }, { status: 400 });
      }
    }

    if (cvFile) {
      let text = "";
      try {
        const buf = Buffer.from(await cvFile.arrayBuffer());
        text = await extractCvText(buf, cvFile.name);
        data.cvText = text;
        create.cvText = text;
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          const blob = await put(`cvs/original-${session.user.id}-${Date.now()}-${cvFile.name}`, buf, {
            access: "public",
            contentType: cvFile.type || undefined,
          });
          data.cvFileUrl = blob.url;
          create.cvFileUrl = blob.url;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json(
          { error: `CV parse failed (${cvFile.name}, ${cvFile.size} bytes): ${msg}` },
          { status: 400 },
        );
      }
    }

    if (preferences) {
      data.preferences = preferences as Prisma.InputJsonValue;
      create.preferences = preferences as Prisma.InputJsonValue;
    }

    await db.profile.upsert({
      where: { userId: session.user.id },
      update: data,
      create,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[profile/import]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
