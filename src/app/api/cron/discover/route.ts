import { NextResponse } from "next/server";
import { runDiscovery } from "@/lib/discover";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  if (!force && auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const report = await runDiscovery();
  return NextResponse.json(report);
}
