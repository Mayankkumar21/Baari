"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin";

export async function markContactedAction(
  interestId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  await db
    .update(schema.planInterest)
    .set({ contactedAt: new Date() })
    .where(eq(schema.planInterest.id, interestId));
  revalidatePath("/admin/interest");
  return { ok: true };
}

export async function markConvertedAction(
  interestId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  await db
    .update(schema.planInterest)
    .set({ convertedAt: new Date() })
    .where(eq(schema.planInterest.id, interestId));
  revalidatePath("/admin/interest");
  return { ok: true };
}
