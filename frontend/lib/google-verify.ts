// Verify Google Sign-In ID tokens server-side. Returns the canonical
// (sub, email, name, picture) on success or null on any failure.
//
// Two modes:
//
//  • PROD: real Google verification via google-auth-library. Requires
//    GOOGLE_WEB_CLIENT_ID env var. Rejects expired, tampered, or
//    wrong-audience tokens.
//
//  • DEV: when DEV_AUTH_ENABLED=true, also accepts tokens of the form
//    `mock:<email>:<name>:<HMAC>` produced by the Replit/Expo stub.
//    The HMAC binds the mock token to our JWT_SECRET so randoms can't
//    forge customer accounts even if they discover the endpoint.
//
// Production builds with DEV_AUTH_ENABLED unset will ALWAYS use the
// real path — no accidental mock acceptance.

import { OAuth2Client } from "google-auth-library";
import { createHmac, timingSafeEqual } from "node:crypto";

export type VerifiedGoogleIdentity = {
  googleId: string;
  email: string;
  name: string;
  photoUrl: string | null;
};

let _client: OAuth2Client | null = null;
function client(): OAuth2Client {
  if (_client) return _client;
  const clientId = process.env.GOOGLE_WEB_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_WEB_CLIENT_ID env var is required for Google sign-in");
  }
  _client = new OAuth2Client(clientId);
  return _client;
}

export async function verifyGoogleIdToken(
  idToken: string,
): Promise<VerifiedGoogleIdentity | null> {
  if (!idToken) return null;

  // Dev path — mock tokens accepted only when explicitly enabled.
  if (idToken.startsWith("mock:") && process.env.DEV_AUTH_ENABLED === "true") {
    return verifyMockToken(idToken);
  }

  // Prod path — full Google verification.
  try {
    const ticket = await client().verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_WEB_CLIENT_ID!,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) return null;
    if (payload.email_verified === false) return null;
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email.split("@")[0]!,
      photoUrl: payload.picture ?? null,
    };
  } catch {
    return null;
  }
}

// `mock:<email>:<name>:<hmac>` where hmac = HMAC-SHA256(JWT_SECRET,
// `${email}:${name}`). The Expo stub computes this when AUTH_MODE=mock.
function verifyMockToken(token: string): VerifiedGoogleIdentity | null {
  const secret = process.env.JWT_SECRET || process.env.SECRET_KEY;
  if (!secret) return null;

  const parts = token.split(":");
  if (parts.length < 4 || parts[0] !== "mock") return null;
  // Email is parts[1]; name is parts[2..n-1] joined by ":" (in case the
  // name itself contains a colon); HMAC is the last part.
  const email = parts[1]!;
  const hmacHex = parts[parts.length - 1]!;
  const name = parts.slice(2, parts.length - 1).join(":");
  if (!email || !name || !hmacHex) return null;

  const expected = createHmac("sha256", secret).update(`${email}:${name}`).digest("hex");
  if (!timingEqual(expected, hmacHex)) return null;

  return {
    googleId: `mock-${email}`, // stable identity, isolated namespace
    email,
    name,
    photoUrl: null,
  };
}

function timingEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
