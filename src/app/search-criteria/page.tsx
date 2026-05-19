import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CriteriaForm } from "./CriteriaForm";
import type { Preferences } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SearchCriteriaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await db.profile.findUnique({ where: { userId: session.user.id } });
  const initial = (profile?.preferences as Preferences) ?? {};

  return (
    <div className="py-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Search criteria</h1>
        <p className="text-muted-foreground mt-1">
          Used for both the favorite-companies fit scoring and the broad LinkedIn/Indeed/Adzuna scan.
        </p>
      </header>
      <CriteriaForm initial={initial} />
    </div>
  );
}
