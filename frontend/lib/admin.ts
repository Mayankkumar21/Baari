// Admin authorization — one tiny module so the "who counts as admin?"
// answer is defined in ONE place and every other check imports from
// here. Deliberately NOT a role in the DB — admin is an env-var
// allowlist keyed on a user's mobile so it can't be granted by
// accidentally editing a row. Rotating an admin means editing the
// deploy env, not the DB.

import { notFound } from "next/navigation";
import { normalizeMobile } from "@/lib/auth";
import type { Session } from "@/lib/session";
import { getSession } from "@/lib/session";

// Comma-separated env var. Blank / unset → no admins → /admin is 404
// for everyone. Whitespace and phone-formatting characters get
// normalised the same way login does, so "+91 98931 27527" in the env
// var matches a stored mobile of "9893127527".
function parseAllowlist(): Set<string> {
  const raw = process.env.ADMIN_MOBILES;
  if (!raw) return new Set();
  const out = new Set<string>();
  for (const item of raw.split(",")) {
    const m = normalizeMobile(item);
    if (m) out.add(m);
  }
  return out;
}

// Cached across the request lifetime — env var reads are cheap but the
// Set creation isn't free, and this is called on every /admin/* hit.
let _cached: { snapshot: Set<string>; capturedFrom: string | undefined } | null = null;
function allowlist(): Set<string> {
  const current = process.env.ADMIN_MOBILES;
  if (!_cached || _cached.capturedFrom !== current) {
    _cached = { snapshot: parseAllowlist(), capturedFrom: current };
  }
  return _cached.snapshot;
}

export function isAdminMobile(mobile: string | null | undefined): boolean {
  if (!mobile) return false;
  const normalised = normalizeMobile(mobile);
  if (!normalised) return false;
  return allowlist().has(normalised);
}

export function isAdmin(session: Session | null): boolean {
  if (!session) return false;
  return isAdminMobile(session.user.mobile);
}

// Server-only entrypoint for /admin/* pages. Returns the session when
// the caller is authorised; otherwise throws Next's notFound() so the
// user sees the same 404 page every unrecognised URL renders. Never
// returns 401/403 or redirects — a signed-in non-admin who guesses the
// URL should get identical output to a signed-out random visitor.
export async function requireAdmin(): Promise<Session> {
  const sess = await getSession();
  if (!sess || !isAdmin(sess)) notFound();
  return sess;
}

// True iff the workspace is the admin's own placeholder (mobile match).
// Used to exclude "Baari HQ" from KPIs so the admin's own signup
// doesn't inflate active-clinic counts.
export function isAdminWorkspace(user: { mobile: string | null | undefined }): boolean {
  return isAdminMobile(user.mobile);
}
