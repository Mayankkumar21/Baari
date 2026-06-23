// POST /api/v1/me/mobile — first-time mobile capture after Google sign-in.
//
// This is the dedicated onboarding endpoint. PATCH /me also accepts
// mobile updates, but this one is what S2 (the Add-mobile screen) calls;
// keeping it separate makes intent obvious in logs + analytics.

export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import {
  customerToPublic,
  ERRORS,
  ok,
  readJson,
  requireCustomer,
} from "@/lib/api-helpers";
import { normalizeMobile } from "@/lib/auth";

type Body = { mobile?: string; language?: "en" | "hi" };

export async function POST(req: Request) {
  const auth = await requireCustomer(req);
  if (auth instanceof Response) return auth;

  const body = await readJson<Body>(req);
  if (!body?.mobile) return ERRORS.BAD_REQUEST("mobile is required.");

  const m = normalizeMobile(body.mobile);
  if (!m) {
    return ERRORS.VALIDATION(
      "Enter a valid Indian mobile (10 digits, starting with 6, 7, 8 or 9).",
    );
  }

  const lang = body.language === "hi" ? "hi" : auth.language;

  const [updated] = await db
    .update(schema.customers)
    .set({ mobile: m, language: lang })
    .where(eq(schema.customers.id, auth.id))
    .returning();

  return ok({ customer: customerToPublic(updated) });
}
