// Queue state machine + board view-model. Port of app/services/queue_service.py.
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { clinicToday, nowUtc } from "@/lib/time";
import type { Booking, DailySummary, Patient } from "@/lib/db/schema";

export const UNDO_WINDOW_SEC = 30;
export class QueueActionError extends Error {}

// Guards restore / reopen paths against the partial-unique slot index.
// A restored no_show or reopened done booking flips back into a live
// status (checked_in), which the DB now blocks if the slot has been
// re-taken. Pre-checking gives the receptionist a friendly message
// ("that slot is taken now, reschedule first") instead of a raw
// Postgres unique-violation message.
async function slotOccupiedByAnother(
  clinicId: number,
  bookingId: number,
  slotTime: Date,
): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.clinicId, clinicId),
        eq(schema.bookings.slotTime, slotTime),
        ne(schema.bookings.id, bookingId),
        inArray(schema.bookings.status, ["booked", "checked_in", "in_consult"]),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export type QueueRowVM = {
  booking: Booking;
  patient: Patient;
  label: string;
  isLate: boolean;
  isUndoable: boolean;
  // Loyalty snapshot for the queue-board row. Counts prior COMPLETED
  // visits (`done`) for this patient at this clinic, plus the most
  // recent date. Used to render "5th visit · last Nov 3" so the
  // receptionist and doctor can see history without a click.
  //
  // Excludes today's rows so the number reads as "prior visits", not
  // "including this one." Also excludes no-shows/cancelleds — a
  // 3-time no-show isn't a repeat customer, just an unreliable one.
  pastVisits: number;
  lastVisitDate: string | null; // YYYY-MM-DD, IST — display-only
};
export type NowConsultingVM = {
  label: string;
  patientName: string;
  reason: string | null;
  booking: Booking;
};
export type QueueBoardVM = {
  nowConsulting: NowConsultingVM | null;
  waiting: QueueRowVM[];
  done: QueueRowVM[];
  counters: { booked: number; waiting: number; done: number; noShow: number };
  generatedAt: Date;
  isClosed: boolean;
  summary: DailySummary | null;
};

const fmtLabel = (token: number) => `T${token}`;

async function loadBooking(bookingId: number, clinicId: number): Promise<Booking> {
  const [b] = await db
    .select()
    .from(schema.bookings)
    .where(and(eq(schema.bookings.id, bookingId), eq(schema.bookings.clinicId, clinicId)));
  if (!b) throw new QueueActionError("Booking not found.");
  return b;
}

async function anyoneInConsult(clinicId: number, date: string): Promise<boolean> {
  const [b] = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.clinicId, clinicId),
        eq(schema.bookings.date, date),
        eq(schema.bookings.status, "in_consult"),
      ),
    )
    .limit(1);
  return Boolean(b);
}

async function nextCheckedIn(clinicId: number, date: string): Promise<Booking | undefined> {
  const rows = await db
    .select()
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.clinicId, clinicId),
        eq(schema.bookings.date, date),
        eq(schema.bookings.status, "checked_in"),
      ),
    )
    // restoredAt NULLS FIRST so a restored no_show (has a timestamp)
    // sorts AFTER regular check-ins (NULL). Matches buildBoard's
    // in-memory sort, which puts restored patients at the end of the
    // waiting list per PRD §10.5. Without NULLS FIRST, Postgres puts
    // NULLs last on ASC — a restored patient auto-promotes into the
    // in-consult slot ahead of everyone who checked in normally,
    // while the board shows them at the bottom of the queue.
    .orderBy(
      sql`${schema.bookings.restoredAt} ASC NULLS FIRST`,
      asc(schema.bookings.slotTime),
      asc(schema.bookings.token),
    );
  return rows[0];
}

export async function tryPromoteNextBooking(clinicId: number, date: string): Promise<Booking | undefined> {
  if (await anyoneInConsult(clinicId, date)) return;
  const nxt = await nextCheckedIn(clinicId, date);
  if (!nxt) return;
  const now = nowUtc();
  const [updated] = await db
    .update(schema.bookings)
    .set({ status: "in_consult", startedAt: now, updatedAt: now })
    .where(eq(schema.bookings.id, nxt.id))
    .returning();
  return updated;
}

export async function checkIn(clinicId: number, bookingId: number): Promise<void> {
  const b = await loadBooking(bookingId, clinicId);
  if (b.status !== "booked") {
    throw new QueueActionError(`Cannot check in — booking is ${b.status}.`);
  }
  const now = nowUtc();
  await db
    .update(schema.bookings)
    .set({ status: "checked_in", checkedInAt: now, updatedAt: now })
    .where(eq(schema.bookings.id, bookingId));
  await tryPromoteNextBooking(clinicId, b.date);
}

export async function markDone(
  clinicId: number,
  bookingId: number,
  amountPaidInr?: number | null,
  category?: string | null,
): Promise<void> {
  const b = await loadBooking(bookingId, clinicId);
  if (b.status !== "in_consult") {
    throw new QueueActionError("Only the current in-consult booking can be marked done.");
  }
  // Clamp the amount so a bad wire value doesn't poison the report
  // aggregates. Anything <=0 or non-finite falls back to null (not
  // tracked) — the same behavior as "receptionist didn't type it."
  const cleanAmount =
    typeof amountPaidInr === "number" &&
    Number.isFinite(amountPaidInr) &&
    amountPaidInr > 0 &&
    amountPaidInr < 1_000_000
      ? Math.round(amountPaidInr)
      : null;
  // Category is a small free-text bucket. Cap at 40 chars (schema
  // limit) and reject anything empty so the DB stores NULL, not "".
  const cleanCategory =
    typeof category === "string" && category.trim().length > 0
      ? category.trim().slice(0, 40)
      : null;
  const now = nowUtc();
  await db
    .update(schema.bookings)
    .set({
      status: "done",
      completedAt: now,
      updatedAt: now,
      // Only write when we have a real amount — preserve any
      // previously-typed value if the user re-marks (rare but
      // possible via reopen → done).
      ...(cleanAmount !== null ? { amountPaidInr: cleanAmount } : {}),
      ...(cleanCategory !== null ? { category: cleanCategory } : {}),
    })
    .where(eq(schema.bookings.id, bookingId));
  await tryPromoteNextBooking(clinicId, b.date);
}

export async function startConsult(clinicId: number, bookingId: number): Promise<void> {
  const b = await loadBooking(bookingId, clinicId);
  if (b.status !== "checked_in") {
    throw new QueueActionError("Booking is not checked in.");
  }
  if (await anyoneInConsult(clinicId, b.date)) {
    throw new QueueActionError("Another consult is already active.");
  }
  const now = nowUtc();
  await db
    .update(schema.bookings)
    .set({ status: "in_consult", startedAt: now, updatedAt: now })
    .where(eq(schema.bookings.id, bookingId));
}

export async function restoreNoShow(clinicId: number, bookingId: number): Promise<void> {
  const b = await loadBooking(bookingId, clinicId);
  if (b.status !== "no_show") {
    throw new QueueActionError("Only a no-show booking can be restored.");
  }
  // Someone else has taken the slot since this booking went no_show.
  // Flipping back to checked_in would violate the slot partial unique
  // index — give a friendly message before the DB throws.
  if (await slotOccupiedByAnother(clinicId, bookingId, b.slotTime)) {
    throw new QueueActionError(
      "Someone else is booked into that slot now. Reschedule this booking first, then restore it.",
    );
  }
  const now = nowUtc();
  await db
    .update(schema.bookings)
    .set({
      status: "checked_in",
      noShowAt: null,
      restoredAt: now,
      checkedInAt: b.checkedInAt ?? now,
      updatedAt: now,
    })
    .where(eq(schema.bookings.id, bookingId));
  await tryPromoteNextBooking(clinicId, b.date);
}

// After the 30s "undo" window has closed, the receptionist can still flip a
// done/no-show back into the queue — but only with a reason, which we
// write to audit_log so there's a paper trail.
export async function markNoShowManual(
  clinicId: number,
  bookingId: number,
): Promise<Booking> {
  const b = await loadBooking(bookingId, clinicId);
  if (b.status === "done" || b.status === "no_show" || b.status === "cancelled") {
    throw new QueueActionError(`Cannot mark no-show — booking is ${b.status}.`);
  }
  const now = nowUtc();
  const [updated] = await db
    .update(schema.bookings)
    .set({ status: "no_show", noShowAt: now, updatedAt: now })
    .where(eq(schema.bookings.id, bookingId))
    .returning();
  await db
    .update(schema.patients)
    .set({ noShowCount: sql`${schema.patients.noShowCount} + 1` })
    .where(eq(schema.patients.id, b.patientId));
  // Pull the next checked-in patient into the in_consult slot if it just
  // freed up.
  await tryPromoteNextBooking(clinicId, b.date);
  return updated;
}

export async function reopenBooking(args: {
  clinicId: number;
  bookingId: number;
  userId: number;
  reason: string;
}): Promise<Booking> {
  const reason = (args.reason ?? "").trim();
  if (reason.length < 2) {
    throw new QueueActionError("Please give a short reason for reopening.");
  }
  const b = await loadBooking(args.bookingId, args.clinicId);
  if (b.status !== "done" && b.status !== "no_show") {
    throw new QueueActionError("Only done or no-show bookings can be reopened.");
  }
  // Same slot-index race as restoreNoShow: reopening drops the row
  // back into checked_in, which would collide with any live booking
  // at the same slot_time.
  if (await slotOccupiedByAnother(args.clinicId, args.bookingId, b.slotTime)) {
    throw new QueueActionError(
      "Someone else is booked into that slot now. Reschedule this booking first, then reopen it.",
    );
  }
  const now = nowUtc();
  const [updated] = await db
    .update(schema.bookings)
    .set({
      status: "checked_in",
      completedAt: null,
      noShowAt: null,
      checkedInAt: b.checkedInAt ?? now,
      updatedAt: now,
    })
    .where(eq(schema.bookings.id, args.bookingId))
    .returning();
  // Write the reason to audit_log for the paper trail.
  await db.insert(schema.auditLog).values({
    clinicId: args.clinicId,
    userId: args.userId,
    eventType: "booking.reopen",
    entityType: "booking",
    entityId: args.bookingId,
    changes: { previousStatus: b.status, reason: reason.slice(0, 200) },
  });
  await tryPromoteNextBooking(args.clinicId, b.date);
  return updated;
}

export async function undoDone(clinicId: number, bookingId: number): Promise<void> {
  const b = await loadBooking(bookingId, clinicId);
  if (b.status !== "done") {
    throw new QueueActionError("This booking isn't in a done state.");
  }
  if (!b.completedAt) throw new QueueActionError("Missing completion timestamp.");
  const age = (Date.now() - b.completedAt.getTime()) / 1000;
  if (age > UNDO_WINDOW_SEC) {
    throw new QueueActionError("Undo window has expired.");
  }
  // Slot-uniq guard: someone may have booked into b's slot in the 30s
  // window since b flipped to done. Undoing would re-add b to the
  // partial unique index at that slot and collide.
  if (await slotOccupiedByAnother(clinicId, bookingId, b.slotTime)) {
    throw new QueueActionError(
      "That slot has been rebooked — undo window closed for this one.",
    );
  }
  // Reverse any auto-promotion that filled the in-consult slot.
  const [current] = await db
    .select()
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.clinicId, clinicId),
        eq(schema.bookings.date, b.date),
        eq(schema.bookings.status, "in_consult"),
      ),
    )
    .limit(1);
  const now = nowUtc();
  if (current && current.id !== bookingId) {
    await db
      .update(schema.bookings)
      .set({ status: "checked_in", startedAt: null, updatedAt: now })
      .where(eq(schema.bookings.id, current.id));
  }
  await db
    .update(schema.bookings)
    .set({ status: "in_consult", completedAt: null, updatedAt: now })
    .where(eq(schema.bookings.id, bookingId));
}

export async function buildBoard(clinicId: number): Promise<QueueBoardVM> {
  const today = clinicToday();
  const now = nowUtc();

  // Order by slot_time first so the owner sees appointments in the
  // order they'll be served. Token is only a display label — it
  // reflects creation order, not scheduling order. A late-created
  // booking for an earlier slot (walk-in for 1:00 PM at 11:30 AM)
  // should sit BEFORE a T-lower booking for 3:00 PM. Token is the
  // deterministic tie-breaker when two bookings share a slot_time.
  const bookings = await db
    .select()
    .from(schema.bookings)
    .where(and(eq(schema.bookings.clinicId, clinicId), eq(schema.bookings.date, today)))
    .orderBy(asc(schema.bookings.slotTime), asc(schema.bookings.token));

  const patientIds = Array.from(new Set(bookings.map((b) => b.patientId)));
  const patients = patientIds.length
    ? await db.select().from(schema.patients).where(inArray(schema.patients.id, patientIds))
    : [];
  const patientById = new Map(patients.map((p) => [p.id, p]));

  // Loyalty snapshot per patient in one round-trip. Aggregates strictly
  // BEFORE today so an in-flight booking doesn't inflate their own
  // count. "done" only — a repeat no-show isn't a returning customer.
  //
  // Empty patientIds → skip the query entirely so an empty queue day
  // stays a single-round-trip render.
  const loyaltyRows = patientIds.length
    ? await db
        .select({
          patientId: schema.bookings.patientId,
          visits: sql<number>`count(*)::int`,
          lastDate: sql<string>`max(${schema.bookings.date})::text`,
        })
        .from(schema.bookings)
        .where(
          and(
            eq(schema.bookings.clinicId, clinicId),
            inArray(schema.bookings.patientId, patientIds),
            eq(schema.bookings.status, "done"),
            sql`${schema.bookings.date} < ${today}`,
          ),
        )
        .groupBy(schema.bookings.patientId)
    : [];
  const loyaltyByPatient = new Map(
    loyaltyRows.map((r) => [
      r.patientId,
      {
        visits: Number(r.visits),
        lastDate: r.lastDate ? String(r.lastDate) : null,
      },
    ]),
  );

  let nowConsulting: NowConsultingVM | null = null;
  const waiting: QueueRowVM[] = [];
  const done: QueueRowVM[] = [];
  const counters = { booked: 0, waiting: 0, done: 0, noShow: 0 };

  for (const b of bookings) {
    const p = patientById.get(b.patientId);
    if (!p) continue;
    const slotMs = new Date(b.slotTime).getTime();
    const isLate =
      (b.status === "booked" || b.status === "checked_in") &&
      (now.getTime() - slotMs) / 1000 >= 15 * 60;
    const isUndoable =
      b.status === "done" &&
      b.completedAt != null &&
      (now.getTime() - b.completedAt.getTime()) / 1000 <= UNDO_WINDOW_SEC;
    const loyalty = loyaltyByPatient.get(b.patientId);

    const vm: QueueRowVM = {
      booking: b,
      patient: p,
      label: fmtLabel(b.token),
      isLate,
      isUndoable,
      pastVisits: loyalty?.visits ?? 0,
      lastVisitDate: loyalty?.lastDate ?? null,
    };

    if (b.status === "in_consult") {
      nowConsulting = {
        label: fmtLabel(b.token),
        patientName: p.name,
        reason: b.reason,
        booking: b,
      };
    }

    if (b.status === "booked" || b.status === "checked_in") {
      waiting.push(vm);
      counters.waiting += 1;
    } else if (b.status === "done") {
      done.push(vm);
      counters.done += 1;
    } else if (b.status === "no_show") {
      counters.noShow += 1;
      done.push(vm);
    }
    if (b.status !== "cancelled") counters.booked += 1;
  }

  // Restored patients sort to the end of waiting (PRD §10.5). Within
  // non-restored, order by slot_time (then token as tie-break) so the
  // board mirrors the queuePosition math used by the customer app.
  waiting.sort((a, b) => {
    const aR = a.booking.restoredAt ? 1 : 0;
    const bR = b.booking.restoredAt ? 1 : 0;
    if (aR !== bR) return aR - bR;
    const aRT = a.booking.restoredAt?.getTime() ?? 0;
    const bRT = b.booking.restoredAt?.getTime() ?? 0;
    if (aRT !== bRT) return aRT - bRT;
    const aSlot = new Date(a.booking.slotTime).getTime();
    const bSlot = new Date(b.booking.slotTime).getTime();
    if (aSlot !== bSlot) return aSlot - bSlot;
    return a.booking.token - b.booking.token;
  });

  // Read daily_summaries to know if the day was closed.
  const [summary] = await db
    .select()
    .from(schema.dailySummaries)
    .where(
      and(
        eq(schema.dailySummaries.clinicId, clinicId),
        eq(schema.dailySummaries.date, today),
      ),
    )
    .limit(1);

  return {
    nowConsulting,
    waiting,
    done,
    counters,
    generatedAt: now,
    isClosed: Boolean(summary?.closedAt),
    summary: summary ?? null,
  };
}
