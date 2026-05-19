import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { detectAtsFromUrl, discoverCareersPage } from "@/lib/ats";
import { normalizeCompanyName } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companies = await db.company.findMany({
    where: { isFavorite: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ companies });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as { name: string; careersUrl?: string };
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // Detect ATS — either from provided URL, or discover one from the name.
  let detection = body.careersUrl ? detectAtsFromUrl(body.careersUrl) : null;
  let careersUrl = body.careersUrl ?? null;
  if (!detection || detection.type === "generic_html" || detection.type === "unknown") {
    const discovered = await discoverCareersPage(body.name);
    if (discovered) {
      detection = discovered.detection;
      careersUrl = discovered.url;
    }
  }

  const normalized = normalizeCompanyName(body.name);
  const created = await db.company.upsert({
    where: { normalizedName: normalized },
    update: {
      name: body.name,
      careersUrl,
      atsType: detection?.type ?? "unknown",
      atsSlug: detection?.slug ?? null,
      atsTenant: detection?.tenant ?? null,
      atsHost: detection?.host ?? null,
      atsSite: detection?.site ?? null,
      isFavorite: true,
      active: true,
    },
    create: {
      name: body.name,
      normalizedName: normalized,
      careersUrl,
      atsType: detection?.type ?? "unknown",
      atsSlug: detection?.slug ?? null,
      atsTenant: detection?.tenant ?? null,
      atsHost: detection?.host ?? null,
      atsSite: detection?.site ?? null,
      isFavorite: true,
      active: true,
    },
  });
  return NextResponse.json({ company: created });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = (await req.json()) as { id: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const company = await db.company.findUnique({ where: { id } });
  if (!company) return NextResponse.json({ error: "not found" }, { status: 404 });
  const discovered = await discoverCareersPage(company.name);
  const updated = await db.company.update({
    where: { id },
    data: {
      careersUrl: discovered?.url ?? company.careersUrl,
      atsType: discovered?.detection.type ?? "unknown",
      atsSlug: discovered?.detection.slug ?? null,
      atsTenant: discovered?.detection.tenant ?? null,
      atsHost: discovered?.detection.host ?? null,
      atsSite: discovered?.detection.site ?? null,
      lastError: null,
    },
  });
  return NextResponse.json({ company: updated });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = (await req.json()) as { id: string };
  await db.company.update({ where: { id }, data: { isFavorite: false, active: false } });
  return NextResponse.json({ ok: true });
}
