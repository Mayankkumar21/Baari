// Shape served to the live-status poller (C4). Pure read-side: no
// mutations, no auth (the token IS the auth). Keep it cheap — runs every
// 15s per connected customer.
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { getBookingRequestByToken, queuePosition } from "./booking-request";
import { nowUtc } from "@/lib/time";

export type StatusFeed = {
  bookingId: number;
  token: number;
  status: string;
  slotIso: string;
  position: number;
  totalWaiting: number;
  estWaitMinutes: number | null;
  inSession: { token: number } | null;
  startedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  clinicName: string;
  clinicAddress: string | null;
  slotLengthMin: number;
};

export async function getStatusFeed(token: string): Promise<StatusFeed | null> {
  const found = await getBookingRequestByToken(token);
  if (!found?.request.bookingId) return null;

  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, found.request.bookingId))
    .limit(1);
  if (!booking) return null;

  const pos = await queuePosition(found.clinic.id, booking.id);
  const slotLen = found.clinic.slotLengthMin ?? 20;

  // Wait estimate: position × slot length, with a small floor when waiting
  // is non-zero (a slot rarely runs perfectly to time).
  let estWait: number | null = null;
  if (booking.status === "booked" || booking.status === "checked_in") {
    const aheadCount = pos?.position ?? 0;
    estWait = Math.max(2, aheadCount * slotLen);
  }

  return {
    bookingId: booking.id,
    // Slot-order display token — same 1..N number the queue board and
    // staff would call out. Falls back to the DB token only for a
    // cancelled booking (displayToken is null in that state).
    token: pos?.displayToken ?? booking.token,
    status: booking.status,
    slotIso: new Date(booking.slotTime).toISOString(),
    position: pos?.position ?? 0,
    totalWaiting: pos?.totalWaiting ?? 0,
    estWaitMinutes: estWait,
    inSession: pos?.inSession ? { token: pos.inSession.token } : null,
    startedAt: booking.startedAt ? new Date(booking.startedAt).toISOString() : null,
    cancelledAt: booking.cancelledAt ? new Date(booking.cancelledAt).toISOString() : null,
    completedAt: booking.completedAt ? new Date(booking.completedAt).toISOString() : null,
    clinicName: found.clinic.name,
    clinicAddress: found.clinic.address,
    slotLengthMin: slotLen,
  };
}
