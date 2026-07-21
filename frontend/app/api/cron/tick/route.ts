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
  // Fail-CLOSED. If CRON_SECRET is unset or is the placeholder value in
  // production, the endpoint is public — an attacker can hammer it into
  // sweeping every clinic's bookings. Only skip the auth check outside
  // of production, and even then require a real secret if one is set.
  const isProd = process.env.NODE_ENV === "production";
  const isPlaceholder = !expected || expected === "change-me";
  if (isProd && isPlaceholder) {
    return NextResponse.json(
      { error: "cron secret not configured" },
      { status: 503 },
    );
  }
  if (!isPlaceholder && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find clinics with their no_show_threshold_min and sweep stale checked-in/booked rows.
  // "Today" is resolved per-clinic — a US clinic's Monday can still be
  // in progress while an Indian clinic's Tuesday has begun, and the
  // bookings.date column holds each clinic's local YYYY-MM-DD.
  const clinics = await db.select().from(schema.clinics);
  let noShowed = 0;
  for (const clinic of clinics) {
    const today = clinicToday(clinic.timezone);
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
  // "waiting" counts. Per-clinic since "today" differs across zones.
  let zombieSwept = 0;
  for (const clinic of clinics) {
    const today = clinicToday(clinic.timezone);
    const z = await db
      .update(schema.bookings)
      .set({ status: "no_show", noShowAt: now, updatedAt: now })
      .where(
        and(
          eq(schema.bookings.clinicId, clinic.id),
          lt(schema.bookings.date, today),
          inArray(schema.bookings.status, ["booked", "checked_in"]),
        ),
      );
    zombieSwept += (z as { rowCount?: number }).rowCount ?? 0;
  }

  const gc = await gcOldBuckets();

  return NextResponse.json({
    ok: true,
    noShowed,
    zombieSwept,
    gcBuckets: gc,
    at: now.toISOString(),
  });
}
