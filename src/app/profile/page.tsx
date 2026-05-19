import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ProfileUI } from "./ProfileUI";
import { SearchCriteriaCard } from "@/components/SearchCriteriaCard";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await db.profile.findUnique({ where: { userId: session.user.id } });

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-end justify-between">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Your profile</h1>
          <p className="text-muted-foreground mt-1">LinkedIn, CV, voice notes — anything the AI uses to tailor.</p>
        </header>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="ghost" size="sm">
            <LogOut className="size-4" /> Sign out
          </Button>
        </form>
      </div>
      <SearchCriteriaCard />
      <ProfileUI profile={profile} userEmail={session.user.email ?? ""} />
    </div>
  );
}
