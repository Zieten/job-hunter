import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runAggregatorPhase, runFetchBatch, runScoreBatch } from "@/lib/scan";

export const runtime = "nodejs";
// Vercel Hobby caps function execution at 60s. Each phase below is bounded to
// finish well inside that; the client loops the route until phases report done.
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let mode = "";
  try {
    const body = (await req.json()) as { mode?: string };
    mode = body?.mode ?? "";
  } catch {
    // no body — fall through to the unknown-mode error
  }

  try {
    if (mode === "aggregators") {
      return NextResponse.json(await runAggregatorPhase(session.user.id));
    }
    if (mode === "fetch") {
      return NextResponse.json(await runFetchBatch());
    }
    if (mode === "score") {
      return NextResponse.json(await runScoreBatch(session.user.id));
    }
    return NextResponse.json(
      { error: `unknown mode "${mode}" — expected aggregators | fetch | score` },
      { status: 400 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
