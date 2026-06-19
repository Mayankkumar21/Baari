// Queue state machine + board view-model. Port of app/services/queue_service.py.
// Sub-token (family-member) flow is intentionally omitted from this evening's
// MVP — board reads will surface them, but the dispatch + mark-done actions
// only operate on the parent booking. See STATUS.md.
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { clinicToday, nowUtc } from "@/lib/time";
import type { Booking, Patient, SubToken } from "@/lib/db/schema";

export const UNDO_WINDOW_SEC = 30;
export class QueueActionError extends Error {}

export type SubTokenVM = { subToken: SubToken; label: string };
export type QueueRowVM = {
  booking: Booking;
  patient: Patient;
  subTokens: SubToken[];
  label: string;
  isLate: boolean;
  isUndoable: boolean;
  pendingSubCount: number;
};
export type NowConsultingVM = {
  label: string;
  patientName: string;
  reason: string | null;
  booking: Booking;
  subToken: SubToken | null;
  pendingSubs: SubTokenVM[];
};
export type QueueBoardVM = {
  nowConsulting: NowConsultingVM | null;
  waiting: QueueRowVM[];
  done: QueueRowVM[];
  counters: { booked: number; waiting: number; done: number; noShow: number };
  generatedAt: Date;
  isClosed: boolean;
};

const fmtLabel = (token: number, suffix?: number) =>
  suffix ? `T${token}.${suffix}` : `T${token}`;

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
    .orderBy(asc(schema.bookings.restoredAt), asc(schema.bookings.token));
  return rows[0];
}

async function tryPromoteNextBooking(clinicId: number, date: string): Promise<Booking | undefined> {
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

export async function markDone(clinicId: number, bookingId: number): Promise<void> {
  const b = await loadBooking(bookingId, clinicId);
  if (b.status !== "in_consult") {
    throw new QueueActionError("Only the current in-consult booking can be marked done.");
  }
  const now = nowUtc();
  await db
    .update(schema.bookings)
    .set({ status: "done", completedAt: now, updatedAt: now })
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

  const bookings = await db
    .select()
    .from(schema.bookings)
    .where(and(eq(schema.bookings.clinicId, clinicId), eq(schema.bookings.date, today)))
    .orderBy(asc(schema.bookings.token));

  const patientIds = Array.from(new Set(bookings.map((b) => b.patientId)));
  const patients = patientIds.length
    ? await db.select().from(schema.patients).where(inArray(schema.patients.id, patientIds))
    : [];
  const patientById = new Map(patients.map((p) => [p.id, p]));

  const bookingIds = bookings.map((b) => b.id);
  const subs = bookingIds.length
    ? await db
        .select()
        .from(schema.subTokens)
        .where(inArray(schema.subTokens.bookingId, bookingIds))
        .orderBy(asc(schema.subTokens.suffix))
    : [];
  const subsByBooking = new Map<number, SubToken[]>();
  for (const s of subs) {
    const arr = subsByBooking.get(s.bookingId) ?? [];
    arr.push(s);
    subsByBooking.set(s.bookingId, arr);
  }

  let nowConsulting: NowConsultingVM | null = null;
  const waiting: QueueRowVM[] = [];
  const done: QueueRowVM[] = [];
  const counters = { booked: 0, waiting: 0, done: 0, noShow: 0 };

  for (const b of bookings) {
    const p = patientById.get(b.patientId);
    if (!p) continue;
    const bookingSubs = subsByBooking.get(b.id) ?? [];
    const slotMs = new Date(b.slotTime).getTime();
    const isLate =
      (b.status === "booked" || b.status === "checked_in") &&
      (now.getTime() - slotMs) / 1000 >= 15 * 60;
    const isUndoable =
      b.status === "done" &&
      b.completedAt != null &&
      (now.getTime() - b.completedAt.getTime()) / 1000 <= UNDO_WINDOW_SEC;
    const pendingSubCount = bookingSubs.filter((s) => s.status === "booked").length;

    const vm: QueueRowVM = {
      booking: b,
      patient: p,
      subTokens: bookingSubs,
      label: fmtLabel(b.token),
      isLate,
      isUndoable,
      pendingSubCount,
    };

    if (b.status === "in_consult") {
      nowConsulting = {
        label: fmtLabel(b.token),
        patientName: p.name,
        reason: b.reason,
        booking: b,
        subToken: null,
        pendingSubs: bookingSubs
          .filter((s) => s.status === "booked")
          .map((s) => ({ subToken: s, label: fmtLabel(b.token, s.suffix) })),
      };
    } else {
      const activeSub = bookingSubs.find((s) => s.status === "in_consult");
      if (activeSub) {
        nowConsulting = {
          label: fmtLabel(b.token, activeSub.suffix),
          patientName: activeSub.name,
          reason: activeSub.reason,
          booking: b,
          subToken: activeSub,
          pendingSubs: bookingSubs
            .filter((s) => s.status === "booked")
            .map((s) => ({ subToken: s, label: fmtLabel(b.token, s.suffix) })),
        };
      }
    }

    if (b.status === "booked" || b.status === "checked_in") {
      waiting.push(vm);
      counters.waiting += 1;
    } else if (
      b.status === "done" &&
      !bookingSubs.some((s) => s.status === "in_consult" || s.status === "booked")
    ) {
      done.push(vm);
      counters.done += 1;
    } else if (b.status === "no_show") {
      counters.noShow += 1;
      done.push(vm);
    }
    if (b.status !== "cancelled") counters.booked += 1;
  }

  // Restored patients sort to the end of waiting (PRD §10.5).
  waiting.sort((a, b) => {
    const aR = a.booking.restoredAt ? 1 : 0;
    const bR = b.booking.restoredAt ? 1 : 0;
    if (aR !== bR) return aR - bR;
    const aT = a.booking.restoredAt?.getTime() ?? 0;
    const bT = b.booking.restoredAt?.getTime() ?? 0;
    if (aT !== bT) return aT - bT;
    return a.booking.token - b.booking.token;
  });

  return {
    nowConsulting,
    waiting,
    done,
    counters,
    generatedAt: now,
    isClosed: false, // day-close is in STATUS.md as a TODO
  };
}
