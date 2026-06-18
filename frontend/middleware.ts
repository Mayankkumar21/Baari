// Gate all /(app) routes behind a valid session cookie.
// Decoding happens via jose (Edge-compatible); db reads happen in page actions.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth";

const PUBLIC = new Set([
  "/",
  "/login",
  "/signup",
  "/legal/privacy",
  "/legal/terms",
]);

export const config = {
  matcher: ["/((?!_next|api/cron|favicon|.*\\.).*)"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
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
