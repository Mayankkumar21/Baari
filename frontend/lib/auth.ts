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

// International mobile format (E.164). Baari accepts numbers from any
// country as long as they conform to the E.164 shape:
//   +<country code (1-3 digits)><national number>, total 8-15 digits
//
// Backward compatibility: rows written before this change stored 10-digit
// Indian mobiles without a "+" prefix. If the caller doesn't supply a
// leading "+", we fall back to +91 (India) for those 10-digit strings so
// existing data still validates. A leading "+" always wins.
//
// Storage going forward: always E.164 with the "+" prefix (e.g. "+919893127527",
// "+14155550132"). Comparison against legacy 10-digit rows should either
// migrate those rows or strip the "+91" prefix when comparing.
const E164_RE = /^\+[1-9]\d{7,14}$/;
const LEGACY_INDIAN_RE = /^[6-9]\d{9}$/;
export function normalizeMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Strip spaces, dashes, parens, dots — the delimiters people paste in.
  // Preserve the leading "+" so we can tell E.164 from a bare number.
  const cleaned = raw.trim().replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+")) {
    return E164_RE.test(cleaned) ? cleaned : null;
  }
  // No "+" prefix. Two backward-compat fallbacks:
  //   1) A bare 10-digit Indian mobile — assume +91 (legacy behavior).
  //   2) A number that starts with "91" and has 12 total digits — also
  //      Indian (someone pasted "919893127527" from a contact card).
  //   3) A number starting with "0" and 11 total digits — Indian STD-style,
  //      strip the leading 0 and prepend +91.
  if (LEGACY_INDIAN_RE.test(cleaned)) return "+91" + cleaned;
  if (/^91[6-9]\d{9}$/.test(cleaned)) return "+" + cleaned;
  if (/^0[6-9]\d{9}$/.test(cleaned)) return "+91" + cleaned.slice(1);
  return null;
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
