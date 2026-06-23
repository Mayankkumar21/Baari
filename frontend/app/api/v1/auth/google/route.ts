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
import { ERRORS, ok, readJson, customerToPublic } from "@/lib/api-helpers";
import { verifyGoogleIdToken } from "@/lib/google-verify";
import { issueCustomerJwt } from "@/lib/customer-auth";

type Body = { idToken?: string };

export async function POST(req: Request) {
  const body = await readJson<Body>(req);
  const idToken = body?.idToken?.trim();
  if (!idToken) return ERRORS.BAD_REQUEST("idToken is required.");

  const identity = await verifyGoogleIdToken(idToken);
  if (!identity) return ERRORS.UNAUTHORIZED();

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
