"use server";

// Capture "I want to upgrade" clicks from the pricing page while
// payments aren't wired yet. One row per (clinic, desired_plan)
// per 30 days — repeat clicks within a month just refresh the
// existing row's `note` and `updatedAt` (via re-insert would spam;
// so we dedupe first).

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { getSession } from "@/lib/session";
import { normalizeEmail, normalizeMobile } from "@/lib/auth";

export type InterestState = { ok?: boolean; error?: string };

const VALID_PLANS = new Set(["growth", "pro"]);

export async function recordPlanInterestAction(
  _prev: InterestState,
  formData: FormData,
): Promise<InterestState> {
  const sess = await getSession();
  if (!sess) {
    return {
      error: "Please sign in first — that way we know which workspace to upgrade.",
    };
  }

  const desiredPlan = String(formData.get("desired_plan") ?? "").toLowerCase();
  const region = String(formData.get("region") ?? "").toUpperCase() || null;
  const email = normalizeEmail(String(formData.get("email") ?? "")) ?? null;
  const mobile = normalizeMobile(String(formData.get("mobile") ?? "")) ?? null;
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;

  if (!VALID_PLANS.has(desiredPlan)) {
    return { error: "Pick a plan." };
  }
  if (!email && !mobile) {
    return { error: "Leave an email or mobile so we can reach out." };
  }
  if (region && region !== "IN" && region !== "GLOBAL") {
    return { error: "Bad region tag." };
  }

  // Dedupe: if this clinic + desired_plan combo already has an entry
  // in the last 30 days, don't create a duplicate. Callers still get
  // a success response — from the owner's perspective the intent
  // was already logged, no need to expose the internal dedupe.
  const cutoff = new Date(Date.now() - 30 * 86_400_000);
  const [existing] = await db
    .select({ id: schema.planInterest.id })
    .from(schema.planInterest)
    .where(
      and(
        eq(schema.planInterest.clinicId, sess.clinic.id),
        eq(schema.planInterest.desiredPlan, desiredPlan),
        gte(schema.planInterest.createdAt, cutoff),
      ),
    )
    .orderBy(desc(schema.planInterest.createdAt))
    .limit(1);

  if (existing) {
    // Refresh with newest note if the owner clarified. Doesn't
    // bump created_at so the outreach queue stays fair.
    await db
      .update(schema.planInterest)
      .set({
        contactEmail: email ?? sql`contact_email`,
        contactMobile: mobile ?? sql`contact_mobile`,
        note: note ?? sql`note`,
        region,
      })
      .where(eq(schema.planInterest.id, existing.id));
    return { ok: true };
  }

  await db.insert(schema.planInterest).values({
    clinicId: sess.clinic.id,
    userId: sess.user.id,
    desiredPlan,
    region,
    contactEmail: email,
    contactMobile: mobile,
    note,
  });

  return { ok: true };
}
