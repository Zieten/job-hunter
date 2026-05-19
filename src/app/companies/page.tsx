import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CompaniesUI } from "./CompaniesUI";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [companies, growthCompanies] = await Promise.all([
    db.company.findMany({ where: { isFavorite: true }, orderBy: { name: "asc" } }),
    db.company.findMany({
      where: { isFavorite: false, active: true, fundingStage: { not: null } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="py-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Favorite companies</h1>
        <p className="text-muted-foreground mt-1">
          The twice-daily scan pulls fresh postings from these companies' career pages.
        </p>
      </header>
      <CompaniesUI initial={companies} growth={growthCompanies} />
    </div>
  );
}
