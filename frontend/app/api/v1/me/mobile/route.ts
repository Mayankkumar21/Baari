// POST /api/v1/me/mobile — first-time mobile capture after Google sign-in,
// AND mobile-edit from the Profile screen.
//
// Validation order:
//   1. Format (normalizeMobile catches non-Indian / non-numeric)
//   2. Duplicate check: another non-deleted customer already has this mobile
//      → 409 MOBILE_TAKEN
//   3. Cooldown: if THIS customer already had a mobile and changed it less
//      than COOLDOWN_DAYS ago → 412 MOBILE_LOCKED
//   4. Update + cascade patient rows linked by customer_id

export const dynamic = "force-dynamic";

import { and, eq, ne, sql } from "drizzle-orm";
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

type Body = { mobile?: string; language?: "en" | "hi" };

export async function POST(req: Request) {
  const auth = await requireCustomer(req);
  if (auth instanceof Response) return auth;

  const rl = await checkAndIncrement(
    LIMITS.customer_action_per_user,
    "cust_mobile",
    String(auth.id),
  );
  if (!rl.ok) return fail(429, "Too many attempts. Wait a bit.", "RATE_LIMITED");

  const body = await readJson<Body>(req);
  if (!body?.mobile) return ERRORS.BAD_REQUEST("mobile is required.");

  const m = normalizeMobile(body.mobile);
  if (!m) {
    return ERRORS.VALIDATION(
      "Enter a valid mobile number.",
    );
  }

  const lang = body.language === "hi" ? "hi" : auth.language;
  const isChange = auth.mobile && auth.mobile !== m;

  // Duplicate check: any other active customer with this mobile?
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

  // Cooldown: if this is a CHANGE (not first-time set), enforce 30 days.
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

  // Update customer.
  const [updated] = await db
    .update(schema.customers)
    .set({
      mobile: m,
      language: lang,
      ...(isChange ? { mobileChangedAt: new Date() } : {}),
    })
    .where(eq(schema.customers.id, auth.id))
    .returning();

  // Cascade: update patient rows linked to this customer so booking
  // history follows the new mobile. Patient rows from anonymous flows
  // (no customer_id) are left untouched. Conflicts (same clinic already
  // has a patient with the new mobile) are skipped silently — that
  // patient row continues to look like a separate entity, which is
  // acceptable behaviour for v1.
  if (isChange) {
    try {
      await db.execute(sql`
        UPDATE patients
        SET mobile = ${m}
        WHERE customer_id = ${auth.id}
          AND NOT EXISTS (
            SELECT 1 FROM patients p2
            WHERE p2.clinic_id = patients.clinic_id
              AND p2.mobile = ${m}
              AND p2.id <> patients.id
          )
      `);
    } catch (e) {
      // Cascade is best-effort; don't fail the user's mobile update if
      // a clinic-side conflict trips a constraint.
      console.warn("patient mobile cascade failed", e);
    }
  }

  return ok({ customer: customerToPublic(updated) });
}
