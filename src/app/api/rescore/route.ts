import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

// Rescore = wipe every cached fit score, fast. The actual re-scoring is then
// driven by the client looping POST /api/scan {mode:"score"} — same bounded
// scorer the scan uses — so it stays inside the 60s function limit.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const del = await db.fitAssessment.deleteMany({});
    return NextResponse.json({ deleted: del.count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
