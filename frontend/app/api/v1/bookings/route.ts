// POST /api/v1/bookings — create a booking from the customer app
// GET  /api/v1/bookings — list { active, past } for the authed customer
//
// Both require Bearer auth.

export const dynamic = "force-dynamic";

import { ERRORS, ok, readJson, requireCustomer } from "@/lib/api-helpers";
import {
  CustomerBookingError,
  createCustomerBooking,
  listCustomerBookings,
} from "@/lib/services/customer-bookings";

type CreateBody = {
  clinicSlug?: string;
  slotIso?: string;
  reason?: string;
  isNew?: boolean;
};

export async function GET(req: Request) {
  const auth = await requireCustomer(req);
  if (auth instanceof Response) return auth;
  const { active, past } = await listCustomerBookings(auth);
  return ok({ active, past });
}

export async function POST(req: Request) {
  const auth = await requireCustomer(req);
  if (auth instanceof Response) return auth;

  const body = await readJson<CreateBody>(req);
  if (!body?.clinicSlug || !body?.slotIso) {
    return ERRORS.BAD_REQUEST("clinicSlug and slotIso are required.");
  }

  try {
    const booking = await createCustomerBooking({
      customer: auth,
      clinicSlug: body.clinicSlug,
      slotIso: body.slotIso,
      reason: body.reason?.trim() || null,
      isNew: body.isNew ?? false,
    });
    return ok({ booking }, 201);
  } catch (err) {
    if (err instanceof CustomerBookingError) {
      switch (err.code) {
        case "MOBILE_REQUIRED":
          return ERRORS.PRECONDITION(err.message, err.code);
        case "SLOT_TAKEN":
        case "CAP_REACHED":
        case "ANONYMISED":
          return ERRORS.CONFLICT(err.message, err.code);
        case "NOT_FOUND":
          return ERRORS.NOT_FOUND(err.message);
        case "BAD_REQUEST":
          return ERRORS.BAD_REQUEST(err.message);
      }
    }
    console.error("createCustomerBooking failed", err);
    return ERRORS.SERVER();
  }
}
