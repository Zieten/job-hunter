import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";

// Single-user passphrase auth.
// - Set APP_PASSWORD in .env to whatever passphrase you want.
// - Set APP_USER_EMAIL to the email you want associated with your account row
//   (no email is ever sent — it's purely an identifier inside the DB).

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Passphrase",
      credentials: {
        password: { label: "Passphrase", type: "password" },
      },
      async authorize(creds) {
        const provided = (creds?.password ?? "") as string;
        const expected = process.env.APP_PASSWORD ?? "";
        if (!expected || provided !== expected) return null;

        const email = (process.env.APP_USER_EMAIL ?? "owner@local").toLowerCase();
        const user = await db.user.upsert({
          where: { email },
          update: {},
          create: { email, name: "Owner" },
        });
        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.uid && session.user) {
        session.user = { ...session.user, id: token.uid as string };
      }
      return session;
    },
  },
});
