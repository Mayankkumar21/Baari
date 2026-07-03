// POST /api/v1/owner/queue/checkin — mark a booking as checked_in.
//
// Moves booking.status booked → checked_in and stamps checked_in_at.
// Reuses the same queue.checkIn() service the web dashboard's check-in
// action calls, so the promote-next-booking side-effect and status
// invariants stay identical between mobile and web.

export const dynamic = "force-dynamic";

import { checkIn, QueueActionError } from "@/lib/services/queue";
import { ERRORS, ok, readJson, requireOwner } from "@/lib/api-helpers";

type Body = { bookingId?: number };

export async function POST(req: Request) {
  const auth = await requireOwner(req);
  if (auth instanceof Response) return auth;

  const body = await readJson<Body>(req);
  if (!body?.bookingId || !Number.isFinite(body.bookingId)) {
    return ERRORS.BAD_REQUEST("bookingId is required.");
  }

  try {
    // checkIn() looks up the booking and rejects if it doesn't belong to
    // this clinic OR if the current status isn't "booked" — belt-and-
    // braces against a stale mobile client submitting a booking ID from
    // a different tenant.
    await checkIn(auth.clinic.id, body.bookingId);
    return ok({ bookingId: body.bookingId, status: "checked_in" });
  } catch (err) {
    if (err instanceof QueueActionError) {
      return ERRORS.CONFLICT(err.message, "INVALID_STATE");
    }
    console.error("[owner/queue/checkin] crashed:", err);
    return ERRORS.SERVER();
  }
}
