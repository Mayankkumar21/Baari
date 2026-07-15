"use server";

// Admin-only plan grants. Writes plan/plan_source/plan_granted_by/
// plan_trial_ends_at atomically on a single UPDATE. Source is set to
// 'admin_grant' so the resolver knows this plan didn't come from a
// trial or a self-serve payment — the audit trail lives on the row.

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin";

type Tier = "free" | "growth" | "pro";

export async function grantPlanAction(
  clinicId: number,
  tier: Tier,
  expiryDate: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sess = await requireAdmin();
  if (!["free", "growth", "pro"].includes(tier)) {
    return { ok: false, error: "Invalid tier." };
  }

  // Optional expiry — accept YYYY-MM-DD, store as end-of-day UTC so
  // "grant Pro until Dec 31" survives past midnight in most timezones.
  let expiresAt: Date | null = null;
  if (expiryDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
      return { ok: false, error: "Expiry must be YYYY-MM-DD." };
    }
    expiresAt = new Date(`${expiryDate}T23:59:59.999Z`);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return { ok: false, error: "Expiry must be in the future." };
    }
  }

  await db
    .update(schema.clinics)
    .set({
      plan: tier,
      planSource: "admin_grant",
      planGrantedBy: sess.user.id,
      // Trial cutoff doubles as "admin grant cutoff" when source =
      // admin_grant. Null means the grant is permanent (no auto
      // downgrade); a date means downgrade to Free at that time.
      planTrialEndsAt: expiresAt,
    })
    .where(eq(schema.clinics.id, clinicId));

  await db.insert(schema.auditLog).values({
    clinicId,
    userId: sess.user.id,
    eventType: "admin.plan_grant",
    entityType: "clinic",
    entityId: clinicId,
    changes: { tier, expiresAt: expiresAt?.toISOString() ?? null },
  });

  revalidatePath("/admin/workspaces");
  return { ok: true };
}
