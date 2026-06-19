// Day-close — port of app/services/day_close.py.
//
// Sweeps any still-active bookings to no_show (in_consult is treated as
// `done` for the books — the consult was in progress when the day closed),
// recomputes a daily_summaries row, and stamps `closed_at`. Idempotent —
// running again on a closed day refreshes the stats but doesn't double-sweep.
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { clinicToday, nowUtc } from "@/lib/time";
import type { DailySummary, Booking } from "@/lib/db/schema";

const CLINIC_TZ = process.env.CLINIC_TZ ?? "Asia/Kolkata";

export class DayCloseError extends Error {}

export async function getSummary(
  clinicId: number,
  on: string,
): Promise<DailySummary | undefined> {
  const [row] = await db
    .select()
    .from(schema.dailySummaries)
    .where(
      and(
        eq(schema.dailySummaries.clinicId, clinicId),
        eq(schema.dailySummaries.date, on),
      ),
    )
    .limit(1);
  return row;
}

function localHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: CLINIC_TZ,
      hour: "2-digit",
      hour12: false,
    }).format(d),
  );
}

export async function closeDay(
  clinicId: number,
  on?: string,
): Promise<DailySummary> {
  const date = on ?? clinicToday();
  const now = nowUtc();

  // 1. Sweep still-active bookings.
  const candidates = await db
    .select()
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.clinicId, clinicId),
        eq(schema.bookings.date, date),
        inArray(schema.bookings.status, ["booked", "checked_in", "in_consult"]),
      ),
    );

  for (const b of candidates) {
    if (b.status === "in_consult") {
      await db
        .update(schema.bookings)
        .set({ status: "done", completedAt: now, updatedAt: now })
        .where(eq(schema.bookings.id, b.id));
    } else {
      await db
        .update(schema.bookings)
        .set({ status: "no_show", noShowAt: now, updatedAt: now })
        .where(eq(schema.bookings.id, b.id));
      await db
        .update(schema.patients)
        .set({ noShowCount: sql`${schema.patients.noShowCount} + 1` })
        .where(eq(schema.patients.id, b.patientId));
    }
  }

  // 2. Recompute summary from final state.
  const bookings = await db
    .select()
    .from(schema.bookings)
    .where(and(eq(schema.bookings.clinicId, clinicId), eq(schema.bookings.date, date)));

  const completed: Booking[] = [];
  let noShows = 0;
  let cancellations = 0;
  for (const b of bookings) {
    if (b.status === "done") completed.push(b);
    else if (b.status === "no_show") noShows += 1;
    else if (b.status === "cancelled") cancellations += 1;
  }

  const waits: number[] = [];
  const consults: number[] = [];
  const startedTimes: Date[] = [];
  const completedTimes: Date[] = [];
  for (const b of completed) {
    if (b.checkedInAt && b.startedAt) {
      waits.push((b.startedAt.getTime() - b.checkedInAt.getTime()) / 1000);
    }
    if (b.startedAt && b.completedAt) {
      consults.push((b.completedAt.getTime() - b.startedAt.getTime()) / 1000);
      startedTimes.push(b.startedAt);
      completedTimes.push(b.completedAt);
    }
  }

  const avgWait = waits.length
    ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length)
    : null;
  const avgConsult = consults.length
    ? Math.round(consults.reduce((a, b) => a + b, 0) / consults.length)
    : null;

  let peakHour: number | null = null;
  if (startedTimes.length) {
    const buckets = new Map<number, number>();
    for (const t of startedTimes) {
      const h = localHour(t);
      buckets.set(h, (buckets.get(h) ?? 0) + 1);
    }
    peakHour = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  const firstConsultAt = startedTimes.length
    ? new Date(Math.min(...startedTimes.map((t) => t.getTime())))
    : null;
  const lastConsultAt = completedTimes.length
    ? new Date(Math.max(...completedTimes.map((t) => t.getTime())))
    : null;

  const existing = await getSummary(clinicId, date);
  const values = {
    clinicId,
    date,
    totalBookings: bookings.length,
    completed: completed.length,
    noShows,
    cancellations,
    avgWaitSeconds: avgWait,
    avgConsultSeconds: avgConsult,
    peakHour,
    firstConsultAt,
    lastConsultAt,
    closedAt: existing?.closedAt ?? now,
    generatedAt: now,
  };

  if (existing) {
    const [updated] = await db
      .update(schema.dailySummaries)
      .set(values)
      .where(eq(schema.dailySummaries.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(schema.dailySummaries)
    .values(values)
    .returning();
  return created;
}
