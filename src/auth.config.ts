import type { NextAuthConfig } from "next-auth";

// Edge-safe config — no Node.js / Prisma imports.
// Used by middleware for lightweight JWT checks.
// The full config (with Credentials provider + DB) lives in auth.ts.
export const authConfig: NextAuthConfig = {
  providers: [],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if ((user as { id?: string })?.id) token.uid = (user as { id: string }).id;
      return token;
    },
    session({ session, token }) {
      if (token?.uid && session.user) {
        session.user = { ...session.user, id: token.uid as string };
      }
      return session;
    },
  },
};
