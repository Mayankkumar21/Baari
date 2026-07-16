// POST /api/v1/auth/google
//
// Exchange a Google ID token (or a dev-mode mock token) for a Baari
// customer JWT. Finds-or-creates a customers row keyed by googleId.
// Returns the public customer profile + bearer token.
//
// Request:  { idToken: string }
// Response: { ok: true, token: string, customer: PublicCustomer, isNew: boolean }
// Errors:   401 INVALID_TOKEN | 400 BAD_REQUEST

export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { ERRORS, fail, ok, readJson, customerToPublic } from "@/lib/api-helpers";
import { verifyGoogleIdToken } from "@/lib/google-verify";
import { issueCustomerJwt } from "@/lib/customer-auth";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";

type Body = { idToken?: string };

export async function POST(req: Request) {
  const body = await readJson<Body>(req);
  const idToken = body?.idToken?.trim();
  if (!idToken) return ERRORS.BAD_REQUEST("idToken is required.");

  // Per-IP fuse first — stops bots from spinning up customers with N
  // valid Google accounts they control. Google verification below is
  // strong but doesn't prevent inflation of the customers table.
  const ip = getClientIp(req);
  const ipCheck = await checkAndIncrement(LIMITS.signup_google_per_ip, "gauth_ip", ip);
  if (!ipCheck.ok) {
    return fail(429, "Too many sign-in attempts. Try again in an hour.", "RATE_LIMITED");
  }

  const identity = await verifyGoogleIdToken(idToken);
  if (!identity) return ERRORS.UNAUTHORIZED();

  // Per-email fuse only kicks in AFTER Google verifies the token
  // (otherwise an attacker could probe /auth/google to enumerate
  // valid email formats). Legitimate users hit this once when they
  // first sign in; anything more is retry/refresh.
  const emailCheck = await checkAndIncrement(
    LIMITS.signup_google_per_email,
    "gauth_email",
    identity.email.toLowerCase(),
  );
  if (!emailCheck.ok) {
    return fail(429, "Too many sign-in attempts on this account. Try again tomorrow.", "RATE_LIMITED");
  }

  // Upsert customer by googleId.
  const [existing] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.googleId, identity.googleId))
    .limit(1);

  let customer: typeof schema.customers.$inferSelect;
  let isNew = false;

  if (existing) {
    // Refresh display profile from Google in case they updated it.
    // Don't overwrite mobile or language (those are user choices).
    const [updated] = await db
      .update(schema.customers)
      .set({
        name: identity.name,
        email: identity.email,
        photoUrl: identity.photoUrl,
        lastSignInAt: new Date(),
        // Soft-deleted customer signing in again is treated as a
        // fresh restore — clear the tombstone.
        deletedAt: null,
      })
      .where(eq(schema.customers.id, existing.id))
      .returning();
    customer = updated;
  } else {
    const [created] = await db
      .insert(schema.customers)
      .values({
        googleId: identity.googleId,
        email: identity.email,
        name: identity.name,
        photoUrl: identity.photoUrl,
        lastSignInAt: new Date(),
      })
      .returning();
    customer = created;
    isNew = true;
  }

  const { token } = await issueCustomerJwt(customer.id);

  return ok({ token, customer: customerToPublic(customer), isNew });
}
