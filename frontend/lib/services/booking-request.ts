// Booking-request tokens — the SMS link the customer taps after a missed
// call. Each request is single-use, time-boxed, and bound to (clinic,
// mobile). Confirming a request creates a real booking and stamps usedAt.
import { and, eq, lt, ne, or, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, schema } from "@/lib/db/client";
import { nowUtc } from "@/lib/time";
import type { Clinic } from "@/lib/db/schema";
import { normalizeMobile } from "@/lib/auth";

export class BookingRequestError extends Error {}

const LINK_TOKEN_BYTES = 18; // 24 base64url chars, ~144 bits of entropy
const DEFAULT_TTL_HOURS = 2;
export const ACTIVE_BOOKING_CAP = 2; // per (mobile, clinic)

function genToken(): string {
  return randomBytes(LINK_TOKEN_BYTES)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export type RequestWithClinic = {
  request: typeof schema.bookingRequests.$inferSelect;
  clinic: Clinic;
};

export async function getBookingRequestByToken(
  token: string,
): Promise<RequestWithClinic | null> {
  if (!token || token.length < 8) return null;
  const [row] = await db
    .select({
      request: schema.bookingRequests,
      clinic: schema.clinics,
    })
    .from(schema.bookingRequests)
    .innerJoin(schema.clinics, eq(schema.bookingRequests.clinicId, schema.clinics.id))
    .where(eq(schema.bookingRequests.linkToken, token))
    .limit(1);
  return row ?? null;
}

export async function createBookingRequest(args: {
  clinicId: number;
  mobile: string;
  source?: typeof schema.bookingRequestSource.enumValues[number];
  ttlHours?: number;
}): Promise<typeof schema.bookingRequests.$inferSelect> {
  const mobile = normalizeMobile(args.mobile);
  if (!mobile) {
    throw new BookingRequestError(
      "Enter a valid mobile number.",
    );
  }

  // Reuse an existing live request for this (clinic, mobile) instead of
  // creating a duplicate. Prevents rapid re-dialing from minting a fresh
  // link every time and from sending a fresh SMS each call.
  const existing = await db
    .select()
    .from(schema.bookingRequests)
    .where(
      and(
        eq(schema.bookingRequests.clinicId, args.clinicId),
        eq(schema.bookingRequests.mobile, mobile),
        sql`${schema.bookingRequests.usedAt} IS NULL`,
        sql`${schema.bookingRequests.cancelledAt} IS NULL`,
        sql`${schema.bookingRequests.expiresAt} > now()`,
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const ttl = (args.ttlHours ?? DEFAULT_TTL_HOURS) * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttl);
  const [row] = await db
    .insert(schema.bookingRequests)
    .values({
      clinicId: args.clinicId,
      mobile,
      linkToken: genToken(),
      source: args.source ?? "missed_call",
      expiresAt,
    })
    .returning();
  return row;
}

// Count of bookings that "block" further bookings for a mobile at a clinic.
// Cancelled/done/no_show don't count — only the actively-in-flight ones.
export async function activeBookingCountForMobile(
  clinicId: number,
  mobile: string,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.bookings)
    .innerJoin(schema.patients, eq(schema.bookings.patientId, schema.patients.id))
    .where(
      and(
        eq(schema.bookings.clinicId, clinicId),
        eq(schema.patients.mobile, mobile),
        sql`${schema.bookings.status} IN ('booked','checked_in','in_consult')`,
      ),
    );
  return row?.n ?? 0;
}

export async function activeBookingForMobile(clinicId: number, mobile: string) {
  const [row] = await db
    .select({
      id: schema.bookings.id,
      token: schema.bookings.token,
      slotTime: schema.bookings.slotTime,
      reason: schema.bookings.reason,
      status: schema.bookings.status,
      patientName: schema.patients.name,
    })
    .from(schema.bookings)
    .innerJoin(schema.patients, eq(schema.bookings.patientId, schema.patients.id))
    .where(
      and(
        eq(schema.bookings.clinicId, clinicId),
        eq(schema.patients.mobile, mobile),
        sql`${schema.bookings.status} IN ('booked','checked_in','in_consult')`,
      ),
    )
    .orderBy(schema.bookings.slotTime)
    .limit(1);
  return row ?? null;
}

export type RequestStatus =
  | { kind: "ready"; expiresAt: Date } // can pick a slot
  | { kind: "expired" }
  | { kind: "cancelled" }
  | { kind: "confirmed"; bookingId: number };

export function requestStatus(
  req: typeof schema.bookingRequests.$inferSelect,
): RequestStatus {
  if (req.cancelledAt) return { kind: "cancelled" };
  if (req.usedAt && req.bookingId) return { kind: "confirmed", bookingId: req.bookingId };
  if (new Date(req.expiresAt).getTime() <= nowUtc().getTime()) return { kind: "expired" };
  return { kind: "ready", expiresAt: new Date(req.expiresAt) };
}

// Closed-day check — workspace-wide only. Per-doctor rows (user_id set)
// don't affect the whole-clinic view; they'd only apply once the booking
// flow can pick a doctor. Enforced with `user_id IS NULL` so those rows
// stay invisible to today's single-doctor semantics.
export async function isClosedDay(clinicId: number, date: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.closedDays.id })
    .from(schema.closedDays)
    .where(
      and(
        eq(schema.closedDays.clinicId, clinicId),
        eq(schema.closedDays.date, date),
        sql`${schema.closedDays.userId} IS NULL`,
      ),
    )
    .limit(1);
  return !!row;
}

// Cancel a confirmed booking-request → flip booking to cancelled inside a
// transaction. Returns the updated booking row.
export async function cancelBookingFromRequest(args: {
  request: typeof schema.bookingRequests.$inferSelect;
  reason?: string;
}) {
  const { request, reason } = args;
  if (!request.bookingId) {
    throw new BookingRequestError("This request hasn't been used yet.");
  }
  return db.transaction(async (tx) => {
    const [booking] = await tx
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, request.bookingId!))
      .limit(1);
    if (!booking) throw new BookingRequestError("Booking not found.");
    if (booking.status === "cancelled") return booking; // idempotent
    if (booking.status === "done") {
      throw new BookingRequestError("This booking is already complete.");
    }
    if (booking.status === "in_consult") {
      throw new BookingRequestError(
        "You're already in session — please ask the front desk to cancel.",
      );
    }

    const now = nowUtc();
    const [updated] = await tx
      .update(schema.bookings)
      .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
      .where(eq(schema.bookings.id, booking.id))
      .returning();

    await tx
      .update(schema.bookingRequests)
      .set({ cancelledAt: now, cancelReason: reason?.slice(0, 200) ?? null })
      .where(eq(schema.bookingRequests.id, request.id));

    return updated;
  });
}

// Position lookup for the live-status screen. Number of waiting bookings
// (booked + checked_in) AHEAD of this booking, ordered by slot_time
// (then token as tie-breaker). Slot-time ordering matters because a
// booking created later can have an earlier slot — token order alone
// would mis-position them and mis-estimate the wait.
export async function queuePosition(
  clinicId: number,
  bookingId: number,
): Promise<{
  position: number;
  totalWaiting: number;
  inSession: { token: number; bookingId: number } | null;
} | null> {
  const [me] = await db
    .select({
      id: schema.bookings.id,
      token: schema.bookings.token,
      status: schema.bookings.status,
      date: schema.bookings.date,
      slotTime: schema.bookings.slotTime,
    })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);
  if (!me) return null;

  const [waitingRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.clinicId, clinicId),
        eq(schema.bookings.date, me.date),
        sql`${schema.bookings.status} IN ('booked','checked_in')`,
      ),
    );

  // "Ahead of me" = strictly earlier slot_time, OR same slot with a
  // smaller token (deterministic tie-break). This handles the case
  // where two bookings share a slot (party of 2, walk-in) — the older
  // token wins. Uses typed drizzle helpers rather than a raw sql
  // template so postgres-js gets a properly-serialized timestamp
  // instead of a Date object (same class of bug that broke /admin).
  const [aheadRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.clinicId, clinicId),
        eq(schema.bookings.date, me.date),
        sql`${schema.bookings.status} IN ('booked','checked_in')`,
        or(
          lt(schema.bookings.slotTime, me.slotTime),
          and(
            eq(schema.bookings.slotTime, me.slotTime),
            lt(schema.bookings.token, me.token),
          ),
        ),
      ),
    );

  // in_consult check is scoped to the booking's own date (not
  // clinicToday()) so a same-day poll for a future booking doesn't
  // report someone from a different day as "in session".
  const [inSession] = await db
    .select({ id: schema.bookings.id, token: schema.bookings.token })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.clinicId, clinicId),
        eq(schema.bookings.date, me.date),
        eq(schema.bookings.status, "in_consult"),
        ne(schema.bookings.id, bookingId),
      ),
    )
    .limit(1);

  return {
    position: aheadRow?.n ?? 0,
    totalWaiting: waitingRow?.n ?? 0,
    inSession: inSession ? { token: inSession.token, bookingId: inSession.id } : null,
  };
}
