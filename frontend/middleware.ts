// Gate all /(app) routes behind a valid session cookie.
// Decoding happens via jose (Edge-compatible); db reads happen in page actions.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth";

const PUBLIC = new Set([
  "/",
  "/login",
  "/signup",
  "/workspace-deleted",
  "/legal/privacy",
  "/legal/terms",
]);

// Path PREFIXES that are public regardless of session:
//   /api/v1/*  — customer API, uses Bearer-token auth not cookies
//   /api/cron  — already excluded by matcher, kept here for clarity
//   /b/        — public missed-call/SMS booking flow (token in URL is the auth)
const PUBLIC_PREFIXES = ["/api/v1/", "/b/"];

// Exclude /api/v1 + /api/cron from the matcher entirely so they don't even
// hit this middleware. (Belt + braces with PUBLIC_PREFIXES — if Next ever
// changes matcher semantics, the in-fn check is the fallback.)
export const config = {
  matcher: ["/((?!_next|api/cron|api/v1|favicon|.*\\.).*)"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Safety net — even if the matcher lets one of these through, never
  // redirect a customer-API or public-booking request to /login.
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const tok = req.cookies.get(SESSION_COOKIE)?.value;
  const session = tok ? await decodeSession(tok) : null;

  // Authed users hitting /login or /signup → bounce to /queue.
  if (session && (pathname === "/login" || pathname === "/signup" || pathname === "/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/queue";
    return NextResponse.redirect(url);
  }

  // Public routes — no session required.
  if (PUBLIC.has(pathname)) return NextResponse.next();

  // Anything else under the matcher requires a session.
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
