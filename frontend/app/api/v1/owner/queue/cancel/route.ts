// POST /api/v1/owner/queue/cancel — cancel a booking.
// Reuses booking.cancelBooking() which flips status to "cancelled"
// and stamps cancelledAt. Rejects done / no_show / already-cancelled.

export const dynamic = "force-dynamic";

import { BookingError, cancelBooking } from "@/lib/services/booking";
import { ERRORS, fail, ok, readJson, requireOwner } from "@/lib/api-helpers";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";

type Body = { bookingId?: number };

export async function POST(req: Request) {
  const auth = await requireOwner(req);
  if (auth instanceof Response) return auth;

  const rl = await checkAndIncrement(
    LIMITS.owner_mutation_per_user,
    "owner_mutation",
    String(auth.user.id),
  );
  if (!rl.ok) return fail(429, "Too many actions. Slow down.", "RATE_LIMITED");

  const body = await readJson<Body>(req);
  if (!body?.bookingId || !Number.isFinite(body.bookingId)) {
    return ERRORS.BAD_REQUEST("bookingId is required.");
  }

  try {
    await cancelBooking({ clinicId: auth.clinic.id, bookingId: body.bookingId });
    return ok({ bookingId: body.bookingId, status: "cancelled" });
  } catch (err) {
    if (err instanceof BookingError) {
      // "Booking is already done" / "Booking not found" — user-fixable.
      return fail(409, err.message, "INVALID_STATE");
    }
    console.error("[owner/queue/cancel] crashed:", err);
    return ERRORS.SERVER();
  }
}
