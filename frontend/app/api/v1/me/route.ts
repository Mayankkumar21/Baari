// GET    /api/v1/me        — current customer profile
// PATCH  /api/v1/me        — update name/language/notifyTurn
// DELETE /api/v1/me        — soft-delete account
//
// All require Bearer auth via customer JWT.

export const dynamic = "force-dynamic";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import {
  customerToPublic,
  ERRORS,
  fail,
  ok,
  readJson,
  requireCustomer,
} from "@/lib/api-helpers";
import { normalizeMobile } from "@/lib/auth";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";

const COOLDOWN_DAYS = 30;

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

  // Profile updates are cheap by themselves but a mobile-change
  // triggers a patient-row cascade (line ~124 below) which is
  // expensive to run in a hot loop. Cap it per customer.
  const rl = await checkAndIncrement(
    LIMITS.profile_update_per_customer,
    "profile_upd",
    String(auth.id),
  );
  if (!rl.ok) {
    return fail(429, "Too many profile updates. Try again in an hour.", "RATE_LIMITED");
  }

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
        "Enter a valid mobile number.",
      );
    }
    const isChange = auth.mobile && auth.mobile !== m;
    if (auth.mobile !== m) {
      const [dup] = await db
        .select({ id: schema.customers.id })
        .from(schema.customers)
        .where(
          and(
            eq(schema.customers.mobile, m),
            ne(schema.customers.id, auth.id),
            sql`${schema.customers.deletedAt} IS NULL`,
          ),
        )
        .limit(1);
      if (dup) {
        return ERRORS.CONFLICT(
          "Another account is already using this mobile.",
          "MOBILE_TAKEN",
        );
      }
    }
    if (isChange && auth.mobileChangedAt) {
      const since = Date.now() - auth.mobileChangedAt.getTime();
      const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      if (since < cooldownMs) {
        const daysLeft = Math.ceil((cooldownMs - since) / (24 * 60 * 60 * 1000));
        return ERRORS.PRECONDITION(
          `You can change your mobile again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
          "MOBILE_LOCKED",
        );
      }
    }
    updates.mobile = m;
    if (isChange) updates.mobileChangedAt = new Date();
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

  const mobileWasChanged = updates.mobile && updates.mobile !== auth.mobile;
  const newMobile = updates.mobile;

  const [updated] = await db
    .update(schema.customers)
    .set(updates)
    .where(eq(schema.customers.id, auth.id))
    .returning();

  // Cascade: rewire patient rows linked to this customer so booking
  // history follows the new mobile. Skip clinics where rewriting would
  // collide with an existing patient (rare, treated as separate row).
  if (mobileWasChanged) {
    try {
      await db.execute(sql`
        UPDATE patients
        SET mobile = ${newMobile}
        WHERE customer_id = ${auth.id}
          AND NOT EXISTS (
            SELECT 1 FROM patients p2
            WHERE p2.clinic_id = patients.clinic_id
              AND p2.mobile = ${newMobile}
              AND p2.id <> patients.id
          )
      `);
    } catch (e) {
      console.warn("patient mobile cascade failed", e);
    }
  }

  return ok({ customer: customerToPublic(updated) });
}

export async function DELETE(req: Request) {
  const auth = await requireCustomer(req);
  if (auth instanceof Response) return auth;

  // Block deletion if the customer has any live booking. Quietly
  // cancelling their bookings behind the clinic's back means the
  // clinic never learns they aren't coming — no-show accounted to
  // them, chair stays empty, everyone loses. Force the customer to
  // cancel their own bookings first so each clinic gets the proper
  // signal through the normal cancel path (WhatsApp, queue update).
  if (auth.mobile) {
    const active = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .innerJoin(schema.patients, eq(schema.bookings.patientId, schema.patients.id))
      .where(
        and(
          eq(schema.patients.mobile, auth.mobile),
          inArray(schema.bookings.status, ["booked", "checked_in", "in_consult"]),
        ),
      )
      .limit(1);
    if (active.length > 0) {
      return fail(
        409,
        "Cancel your active bookings first, then delete your account. This way each clinic gets a proper heads-up.",
        "HAS_ACTIVE_BOOKINGS",
      );
    }
  }

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
