import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const session = await auth();
  const { from, error } = await searchParams;
  if (session?.user) redirect(from ?? "/");

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6">
      <div className="flex items-center gap-3 mb-6">
        <Briefcase className="size-7 text-primary" />
        <h1 className="text-2xl font-bold">Job Hunter</h1>
      </div>
      <p className="text-muted-foreground text-center max-w-sm mb-6">
        Enter your passphrase to continue.
      </p>
      <form
        action={async (formData) => {
          "use server";
          await signIn("credentials", {
            password: formData.get("password"),
            redirectTo: from ?? "/",
          });
        }}
        className="w-full max-w-xs flex flex-col gap-3"
      >
        <Input
          name="password"
          type="password"
          placeholder="Passphrase"
          required
          autoFocus
          autoComplete="current-password"
        />
        <Button type="submit" size="lg">Sign in</Button>
        {error === "CredentialsSignin" && (
          <p className="text-sm text-destructive text-center">Wrong passphrase.</p>
        )}
      </form>
    </div>
  );
}
