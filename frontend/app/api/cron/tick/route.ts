// Cron tick — runs the no-show sweep, queues wait-time reminders, GCs rate-limit
// buckets. Mirrors app/services/cron_jobs.py. Authenticate via CRON_SECRET header
// when wired to GitHub Actions in production (see STATUS.md).
import { NextResponse } from "next/server";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { clinicToday } from "@/lib/time";
import { gcOldBuckets } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  // Allow blank/placeholder CRON_SECRET in dev — production should override.
  if (expected && expected !== "change-me" && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = clinicToday();
  const now = new Date();

  // Find clinics with their no_show_threshold_min and sweep stale checked-in/booked rows.
  const clinics = await db.select().from(schema.clinics);
  let noShowed = 0;
  for (const clinic of clinics) {
    const cutoff = new Date(now.getTime() - clinic.noShowThresholdMin * 60 * 1000);
    const result = await db
      .update(schema.bookings)
      .set({ status: "no_show", noShowAt: now, updatedAt: now })
      .where(
        and(
          eq(schema.bookings.clinicId, clinic.id),
          eq(schema.bookings.date, today),
          eq(schema.bookings.status, "booked"),
          lt(schema.bookings.slotTime, cutoff),
        ),
      );
    noShowed += (result as { rowCount?: number }).rowCount ?? 0;
  }

  // Zombie sweep — any booking on a past date that's still in a live
  // status (booked / checked_in) never got resolved. Convert to
  // no_show so it stops appearing in customer status polls and owner
  // "waiting" counts. Runs across all clinics in one UPDATE.
  const zombie = await db
    .update(schema.bookings)
    .set({ status: "no_show", noShowAt: now, updatedAt: now })
    .where(
      and(
        lt(schema.bookings.date, today),
        inArray(schema.bookings.status, ["booked", "checked_in"]),
      ),
    );
  const zombieSwept = (zombie as { rowCount?: number }).rowCount ?? 0;

  const gc = await gcOldBuckets();

  return NextResponse.json({
    ok: true,
    noShowed,
    zombieSwept,
    gcBuckets: gc,
    at: now.toISOString(),
  });
}
