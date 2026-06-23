// POST /api/v1/auth/dev
//
// Dev-only sign-in endpoint. Mirrors /auth/google's response shape so
// the mobile stub can use either path interchangeably. Gated by
// DEV_AUTH_ENABLED=true; returns 404 when off so the route is
// invisible in production-style builds.
//
// Two accepted body shapes:
//
//   { mockId: "anjali" | "rohan" | "priya" }
//
//     Resolves to a pre-seeded persona. Same persona signing in twice
//     lands on the same customers row (just like Google would).
//
//   { email, name, mobile? }
//
//     Free-form. Useful for the testing agent to mint a one-off
//     customer for a single test run. googleId is derived from email
//     so multiple calls with the same email map to the same row.

export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { ERRORS, ok, readJson, customerToPublic } from "@/lib/api-helpers";
import { issueCustomerJwt } from "@/lib/customer-auth";
import { devAuthEnabled, resolveDevCustomer } from "@/lib/dev-customers";
import { normalizeMobile } from "@/lib/auth";

type Body = {
  mockId?: string;
  email?: string;
  name?: string;
  mobile?: string;
};

export async function POST(req: Request) {
  if (!devAuthEnabled()) {
    return ERRORS.NOT_FOUND();
  }

  const body = await readJson<Body>(req);
  if (!body) return ERRORS.BAD_REQUEST("Body must be JSON.");

  let googleId: string;
  let email: string;
  let name: string;
  let mobile: string | null = null;

  if (body.mockId) {
    const profile = resolveDevCustomer(body.mockId);
    if (!profile) {
      return ERRORS.BAD_REQUEST(
        `Unknown mockId. Use one of: anjali, rohan, priya.`,
      );
    }
    googleId = profile.googleId;
    email = profile.email;
    name = profile.name;
    mobile = profile.mobile;
  } else if (body.email && body.name) {
    const cleanEmail = body.email.trim().toLowerCase();
    const cleanName = body.name.trim().slice(0, 80);
    if (cleanName.length < 2) {
      return ERRORS.VALIDATION("Name must be at least 2 characters.");
    }
    if (!/^[^@\s]+@[^@\s]+$/.test(cleanEmail)) {
      return ERRORS.VALIDATION("Email looks invalid.");
    }
    googleId = `dev:${cleanEmail}`;
    email = cleanEmail;
    name = cleanName;
    if (body.mobile) {
      const m = normalizeMobile(body.mobile);
      if (!m) {
        return ERRORS.VALIDATION(
          "Mobile must be 10 digits, starting with 6, 7, 8 or 9.",
        );
      }
      mobile = m;
    }
  } else {
    return ERRORS.BAD_REQUEST(
      "Provide either { mockId } or { email, name } (mobile optional).",
    );
  }

  const [existing] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.googleId, googleId))
    .limit(1);

  let customer: typeof schema.customers.$inferSelect;
  let isNew = false;

  if (existing) {
    const [updated] = await db
      .update(schema.customers)
      .set({
        name,
        email,
        lastSignInAt: new Date(),
        deletedAt: null,
        // Override mobile only if the caller explicitly supplied one;
        // otherwise preserve whatever the user typed in S2.
        ...(mobile != null ? { mobile } : {}),
      })
      .where(eq(schema.customers.id, existing.id))
      .returning();
    customer = updated;
  } else {
    const [created] = await db
      .insert(schema.customers)
      .values({
        googleId,
        email,
        name,
        mobile,
        photoUrl: null,
        lastSignInAt: new Date(),
      })
      .returning();
    customer = created;
    isNew = true;
  }

  const { token } = await issueCustomerJwt(customer.id);
  return ok({ token, customer: customerToPublic(customer), isNew });
}
