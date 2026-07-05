"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { requireDoctor } from "@/lib/session";

export type AddClosedDayState = { error?: string; ok?: boolean };

// Cap on how far ahead a closure can be set. Owners may occasionally
// want to block a date months out ("clinic renovation in October"),
// but 2 years is enough for anything reasonable and blocks obvious
// data-entry mistakes ("closed 2099-01-01").
const MAX_YEARS_AHEAD = 2;

export async function addClosedDay(
  _prev: AddClosedDayState,
  formData: FormData,
): Promise<AddClosedDayState> {
  const sess = await requireDoctor();
  const dateStr = String(formData.get("date") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 120) || null;

  // Basic YYYY-MM-DD shape check. Postgres will re-validate on insert.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { error: "Enter a valid date." };
  }
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { error: "Enter a valid date." };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed < today) {
    return { error: "Pick today or a future date." };
  }
  const cutoff = new Date(today);
  cutoff.setFullYear(cutoff.getFullYear() + MAX_YEARS_AHEAD);
  if (parsed > cutoff) {
    return { error: `Pick a date within ${MAX_YEARS_AHEAD} years.` };
  }

  try {
    await db
      .insert(schema.closedDays)
      .values({
        clinicId: sess.clinic.id,
        date: dateStr,
        reason,
      })
      // Idempotent — re-submitting the same date doesn't 500. The
      // reason field could be updated but we keep the original on
      // conflict to preserve audit intent. Owners can delete + re-add
      // if they want a different reason.
      .onConflictDoNothing({
        target: [schema.closedDays.clinicId, schema.closedDays.date],
      });
  } catch (err) {
    console.error("[addClosedDay] failed:", err);
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/settings/hours");
  revalidatePath("/queue");
  return { ok: true };
}

export type RemoveClosedDayState = { error?: string; ok?: boolean };

export async function removeClosedDay(id: number): Promise<RemoveClosedDayState> {
  const sess = await requireDoctor();
  if (!Number.isFinite(id) || id <= 0) return { error: "Bad request." };
  try {
    // clinicId scoping so one workspace can't nuke another's rows even
    // if they guess an id.
    await db
      .delete(schema.closedDays)
      .where(
        and(
          eq(schema.closedDays.id, id),
          eq(schema.closedDays.clinicId, sess.clinic.id),
        ),
      );
  } catch (err) {
    console.error("[removeClosedDay] failed:", err);
    return { error: "Could not delete. Try again." };
  }
  revalidatePath("/settings/hours");
  revalidatePath("/queue");
  return { ok: true };
}
