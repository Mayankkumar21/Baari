// POST /api/v1/bookings/:id/cancel — customer cancels their own booking.

export const dynamic = "force-dynamic";

import { ERRORS, ok, readJson, requireCustomer } from "@/lib/api-helpers";
import {
  CustomerBookingError,
  cancelCustomerBooking,
} from "@/lib/services/customer-bookings";

type Body = { reason?: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCustomer(req);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const bookingId = Number(id);
  if (!Number.isFinite(bookingId)) return ERRORS.BAD_REQUEST("Bad booking id.");

  const body = await readJson<Body>(req);
  try {
    await cancelCustomerBooking({
      customer: auth,
      bookingId,
      reason: body?.reason?.trim() || undefined,
    });
    return ok({ cancelled: true });
  } catch (err) {
    if (err instanceof CustomerBookingError) {
      switch (err.code) {
        case "ALREADY_DONE":
        case "IN_SESSION":
          return ERRORS.CONFLICT(err.message, err.code);
        case "NOT_FOUND":
          return ERRORS.NOT_FOUND(err.message);
        case "MOBILE_REQUIRED":
          return ERRORS.PRECONDITION(err.message, err.code);
      }
    }
    console.error("cancelCustomerBooking failed", err);
    return ERRORS.SERVER();
  }
}
