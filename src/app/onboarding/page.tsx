import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "./OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="py-8 space-y-6 max-w-2xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Welcome — let's get set up</h1>
        <p className="text-muted-foreground mt-1">
          Three quick steps. Takes ~3 minutes. You can come back and edit anything later.
        </p>
      </header>
      <OnboardingWizard />
    </div>
  );
}
