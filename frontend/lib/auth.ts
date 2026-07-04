// Edge-safe auth — JWT sign/verify only. Password hashing lives in
// lib/password.ts so middleware can `import "@/lib/auth"` without
// pulling bcryptjs into the Edge bundle.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "baari_session";
const SESSION_DAYS = { doctor: 7, receptionist: 30 } as const;

export type SessionRole = keyof typeof SESSION_DAYS;
export type SessionPayload = {
  uid: number;
  cid: number;
  role: SessionRole;
};

function secret(): Uint8Array {
  // Accept either name — JWT_SECRET is the preferred convention; SECRET_KEY
  // is the legacy alias kept around so older .env files keep working.
  const s = process.env.JWT_SECRET || process.env.SECRET_KEY;
  if (!s || s.length < 32) {
    throw new Error("JWT_SECRET env var is required (>= 32 chars)");
  }
  return new TextEncoder().encode(s);
}

// Indian mobile: 10 digits, optionally prefixed +91 or 0. Stored as 10 digits.
// Per TRAI, the first digit of an Indian mobile must be 6, 7, 8, or 9 — any
// other leading digit is a landline/STD code or a typo, never a mobile.
const MOBILE_RE = /^(?:\+?91|0)?([6-9]\d{9})$/;
export function normalizeMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[\s-]/g, "");
  const m = MOBILE_RE.exec(cleaned);
  return m ? m[1] : null;
}

// Deliberately loose regex — not RFC-5322 strict (that's a monster). Catches
// the vast majority of typos while accepting anything a real inbox actually
// uses. Structure: <local>@<host>.<tld ≥ 2 chars>. Trimmed + lowercased so
// duplicate detection ("Alice@Foo.com" vs "alice@foo.com") is meaningful.
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  if (cleaned.length === 0 || cleaned.length > 254) return null;
  if (!EMAIL_RE.test(cleaned)) return null;
  // Guard against double-dot payloads regex doesn't catch ("a..b@c.com").
  if (cleaned.includes("..")) return null;
  return cleaned;
}

export async function issueSession(
  payload: SessionPayload,
): Promise<{ token: string; maxAge: number }> {
  const days = SESSION_DAYS[payload.role];
  const maxAge = days * 24 * 60 * 60;
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secret());
  return { token, maxAge };
}

export async function decodeSession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
