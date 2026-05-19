import { NextResponse } from "next/server";
import { runScan } from "@/lib/scan";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 300;

const TZ = process.env.APP_TIMEZONE ?? "America/Los_Angeles";
const ACTIVE_HOURS = [7, 17];

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  if (!force && auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // DST-safe local-time gate: only fire when local hour is 7 or 17.
  if (!force) {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(new Date()),
    );
    if (!ACTIVE_HOURS.includes(hour)) {
      return NextResponse.json({ skipped: true, reason: `local hour ${hour} not in ${ACTIVE_HOURS}` });
    }
  }

  // Find the single (allowlisted) user to scan for.
  const user = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    return NextResponse.json({ skipped: true, reason: "no user yet" });
  }

  try {
    const report = await runScan(user.id);
    return NextResponse.json(report);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
