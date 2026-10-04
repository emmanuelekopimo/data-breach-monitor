import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionSecret, verifySession } from "@/lib/auth/token";

const PUBLIC_ONLY = ["/sign-in", "/sign-up"];

/**
 * Optimistic auth check from the cookie only (no database access).
 * Pages still call requireUser() for the real check.
 */
export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, sessionSecret());
  const isPublicOnly = PUBLIC_ONLY.includes(path);

  if (!session && !isPublicOnly) {
    return NextResponse.redirect(new URL("/sign-in", req.nextUrl));
  }
  if (session && (isPublicOnly || path === "/")) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|icon.svg|.*\\.(?:svg|png|jpg|ico|webp|woff2?)$).*)"],
};
