import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { JobStatus } from "@prisma/client";

export const runtime = "nodejs";

const VALID: JobStatus[] = ["new", "reviewed", "selected", "applied", "dismissed"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = (await req.json()) as { status: JobStatus };
  if (!VALID.includes(status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });

  const updated = await db.jobPosting.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ status: updated.status });
}
