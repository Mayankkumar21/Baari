// GET /api/v1/bookings/:id — single booking (auth-required; can only
// read your own)

export const dynamic = "force-dynamic";

import { ERRORS, fail, ok, requireCustomer } from "@/lib/api-helpers";
import { getCustomerBooking } from "@/lib/services/customer-bookings";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCustomer(req);
  if (auth instanceof Response) return auth;

  const rl = await checkAndIncrement(LIMITS.poll_per_user, "booking_get", String(auth.id));
  if (!rl.ok) return fail(429, "Too many requests.", "RATE_LIMITED");

  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isFinite(bookingId)) return ERRORS.BAD_REQUEST("Bad booking id.");
  const booking = await getCustomerBooking(auth, bookingId);
  if (!booking) return ERRORS.NOT_FOUND("Booking not found.");
  return ok({ booking });
}
