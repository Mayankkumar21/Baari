// GET    /api/v1/me        — current customer profile
// PATCH  /api/v1/me        — update name/language/notifyTurn
// DELETE /api/v1/me        — soft-delete account
//
// All require Bearer auth via customer JWT.

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

export async function GET(req: Request) {
  const auth = await requireCustomer(req);
  if (auth instanceof Response) return auth;
  return ok({ customer: customerToPublic(auth) });
}

type PatchBody = {
  name?: string;
  mobile?: string; // edits go through here too; /me/mobile is the
                   //  onboarding-only endpoint with TRAI validation
  language?: "en" | "hi";
  notifyTurn?: boolean;
};

export async function PATCH(req: Request) {
  const auth = await requireCustomer(req);
  if (auth instanceof Response) return auth;

  const body = await readJson<PatchBody>(req);
  if (!body) return ERRORS.BAD_REQUEST("Body must be JSON.");

  const updates: Partial<typeof schema.customers.$inferInsert> = {};

  if (body.name !== undefined) {
    const trimmed = body.name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      return ERRORS.VALIDATION("Name must be 2-80 characters.");
    }
    updates.name = trimmed;
  }

  if (body.mobile !== undefined) {
    const m = normalizeMobile(body.mobile);
    if (!m) {
      return ERRORS.VALIDATION(
        "Enter a valid Indian mobile (10 digits, starting with 6, 7, 8 or 9).",
      );
    }
    updates.mobile = m;
  }

  if (body.language !== undefined) {
    if (body.language !== "en" && body.language !== "hi") {
      return ERRORS.VALIDATION("Language must be 'en' or 'hi'.");
    }
    updates.language = body.language;
  }

  if (body.notifyTurn !== undefined) {
    updates.notifyTurn = !!body.notifyTurn;
  }

  if (Object.keys(updates).length === 0) {
    return ok({ customer: customerToPublic(auth) });
  }

  const [updated] = await db
    .update(schema.customers)
    .set(updates)
    .where(eq(schema.customers.id, auth.id))
    .returning();

  return ok({ customer: customerToPublic(updated) });
}

export async function DELETE(req: Request) {
  const auth = await requireCustomer(req);
  if (auth instanceof Response) return auth;

  // Soft-delete only — keep the row so any clinic-side patient records
  // referring to this mobile still resolve, and so the user can sign
  // back in within a short window if it was a mistake (next Google
  // sign-in clears deletedAt and restores their account).
  await db
    .update(schema.customers)
    .set({ deletedAt: new Date() })
    .where(eq(schema.customers.id, auth.id));

  return ok({ deleted: true });
}
