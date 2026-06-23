// Verify Google Sign-In ID tokens server-side. Returns the canonical
// (sub, email, name, picture) on success or null on any failure.
//
// Two modes:
//
//  • PROD: real Google verification via google-auth-library. Requires
//    GOOGLE_WEB_CLIENT_ID env var. Rejects expired, tampered, or
//    wrong-audience tokens.
//
//  • DEV: when DEV_AUTH_ENABLED=true, also accepts short-form mock
//    tokens of the shape `mock:<id>` where <id> is one of the
//    pre-defined dev customers (anjali / rohan / priya). The mobile
//    stub can't HMAC against JWT_SECRET (it doesn't have the secret),
//    so we rely on (a) the endpoint being opt-in via env, and (b) the
//    mock IDs being a fixed allow-list — random strangers can't mint
//    arbitrary customer rows.
//
// Production builds with DEV_AUTH_ENABLED unset will ALWAYS use the
// real Google path — no accidental mock acceptance.

import { OAuth2Client } from "google-auth-library";
import { devAuthEnabled, resolveDevCustomer } from "./dev-customers";

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

  // Dev path — `mock:<id>` accepted only when DEV_AUTH_ENABLED is true.
  if (idToken.startsWith("mock:") && devAuthEnabled()) {
    const id = idToken.slice("mock:".length).trim();
    const profile = resolveDevCustomer(id);
    if (!profile) return null;
    return {
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      photoUrl: profile.photoUrl,
    };
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
