// GET /api/v1/bookings/:id/status — polled every 15s by the live-status
// screen. Cheap read: queue position + wait estimate + clinic display
// fields. Auth-gated; one customer can't peek at another's booking.

export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { ERRORS, fail, ok, requireCustomer } from "@/lib/api-helpers";
import { getCustomerBooking } from "@/lib/services/customer-bookings";
import { queuePosition } from "@/lib/services/booking-request";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCustomer(req);
  if (auth instanceof Response) return auth;

  // Poll cap — the live-status screen refetches every 15s. 240/hr
  // means one continuous hour of polling per customer, more than any
  // realistic single wait. Stops a runaway loop / stuck retry from
  // pounding the DB.
  const pollCheck = await checkAndIncrement(
    LIMITS.poll_per_user,
    "status_poll",
    String(auth.id),
  );
  if (!pollCheck.ok) {
    return fail(429, "Too many status refreshes. Try again in a bit.", "RATE_LIMITED");
  }

  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isFinite(bookingId)) return ERRORS.BAD_REQUEST("Bad booking id.");

  const booking = await getCustomerBooking(auth, bookingId);
  if (!booking) return ERRORS.NOT_FOUND("Booking not found.");

  // Resolve clinic for slotLengthMin so the wait estimate is correct.
  const [clinic] = await db
    .select({
      id: schema.clinics.id,
      slotLengthMin: schema.clinics.slotLengthMin,
      name: schema.clinics.name,
      address: schema.clinics.address,
      phone: schema.clinics.phone,
      tenantType: schema.clinics.tenantType,
    })
    .from(schema.clinics)
    .where(eq(schema.clinics.slug, booking.clinicSlug))
    .limit(1);
  if (!clinic) return ERRORS.NOT_FOUND("Clinic not found.");

  const pos = await queuePosition(clinic.id, booking.id);
  const slotLen = clinic.slotLengthMin ?? 20;

  // Wait estimate is the max of two lower bounds:
  //   1. minutes until the booking's own slot_time — you won't be
  //      seen before your appointment even if the queue is empty
  //   2. position * slot_length — you won't be seen before the
  //      people ahead of you
  // Fixes the "position 0, est 2 min" lie when earlier bookings cancel
  // for a slot that's still hours away.
  //
  // NaN-guard: if slotIso ever comes back malformed (data corruption,
  // schema drift), getTime() returns NaN, Math.max(2, NaN, N) returns
  // NaN, and NaN serializes to `null` in JSON — the client then
  // renders "NaN min" or a broken UI. Fall back to the position-only
  // math when the slot time is unusable.
  let estWaitMinutes: number | null = null;
  if (booking.status === "booked" || booking.status === "checked_in") {
    const slotMs = new Date(booking.slotIso).getTime();
    const minutesUntilSlot = Number.isFinite(slotMs)
      ? Math.max(0, Math.round((slotMs - Date.now()) / 60000))
      : 0;
    const positionWait = (pos?.position ?? 0) * slotLen;
    estWaitMinutes = Math.max(2, minutesUntilSlot, positionWait);
  }

  // Clinic closed the day? Let the app show a "closed early" state
  // instead of counting down a queue that isn't moving. Uses the
  // booking's own IST date (not clinicToday) so a poll for tomorrow's
  // booking doesn't get marked closed because the clinic ended today's
  // shift early.
  const bookingDateIst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(booking.slotIso));
  const [dayRow] = await db
    .select({ closedAt: schema.dailySummaries.closedAt })
    .from(schema.dailySummaries)
    .where(
      and(
        eq(schema.dailySummaries.clinicId, clinic.id),
        eq(schema.dailySummaries.date, bookingDateIst),
      ),
    )
    .limit(1);
  const clinicClosed = Boolean(dayRow?.closedAt);

  return ok(
    {
      bookingId: booking.id,
      token: booking.token,
      status: booking.status,
      slotIso: booking.slotIso,
      position: pos?.position ?? 0,
      totalWaiting: pos?.totalWaiting ?? 0,
      estWaitMinutes,
      clinicClosed,
      inSession: pos?.inSession ? { token: pos.inSession.token } : null,
      // Flat fields kept for back-compat with anything reading the
      // previous shape.
      clinicSlug: booking.clinicSlug,
      clinicName: clinic.name,
      clinicAddress: clinic.address ?? null,
      clinicPhone: clinic.phone ?? null,
      clinicTenantType: clinic.tenantType ?? "clinic",
      // Nested object — what the app reads.
      clinic: {
        slug: booking.clinicSlug,
        name: clinic.name,
        address: clinic.address ?? null,
        phone: clinic.phone ?? null,
        tenantType: clinic.tenantType ?? "clinic",
      },
    },
    200,
  );
}
