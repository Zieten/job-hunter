import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Lightweight edge middleware — only imports the DB-free authConfig,
// keeping Prisma out of the edge bundle and under Vercel's 1 MB limit.
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/cron"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return;
  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
