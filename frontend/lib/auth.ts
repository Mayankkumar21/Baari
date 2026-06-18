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
  const s = process.env.SECRET_KEY;
  if (!s || s.length < 32) {
    throw new Error("SECRET_KEY env var is required (>= 32 chars)");
  }
  return new TextEncoder().encode(s);
}

// Indian mobile: 10 digits, optionally prefixed +91 or 0. Stored as 10 digits.
const MOBILE_RE = /^(?:\+?91|0)?(\d{10})$/;
export function normalizeMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[\s-]/g, "");
  const m = MOBILE_RE.exec(cleaned);
  return m ? m[1] : null;
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
