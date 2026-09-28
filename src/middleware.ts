import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic auth redirect for app pages.
 *
 * Runs on the edge, so it only checks that an Auth.js session cookie exists
 * and sends signed-out visitors to /login with a `next` return path. The real
 * authentication and tenant authorization happen server-side in every page,
 * route handler, and server action (requireUser / requireOrgAccess).
 */
const PROTECTED_PREFIXES = ["/app", "/onboarding"];
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  // Auth.js may split large cookies into ".0", ".1" chunks.
  const hasSession = req.cookies
    .getAll()
    .some((c) => SESSION_COOKIES.some((name) => c.name === name || c.name.startsWith(`${name}.`)));
  if (hasSession) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*", "/onboarding"],
};
