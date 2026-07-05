// POST /api/v1/bookings — create a booking from the customer app
// GET  /api/v1/bookings — list { active, past } for the authed customer
//
// Both require Bearer auth.

export const dynamic = "force-dynamic";

import { ERRORS, fail, ok, readJson, requireCustomer } from "@/lib/api-helpers";
import {
  CustomerBookingError,
  createCustomerBooking,
  listCustomerBookings,
} from "@/lib/services/customer-bookings";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";

type CreateBody = {
  clinicSlug?: string;
  slotIso?: string;
  reason?: string;
  isNew?: boolean;
  // Third-party booking. Booking on someone else's behalf; guestName
  // required if either is set, guestMobile validated as an Indian
  // number when non-empty. Both optional overall.
  guestName?: string;
  guestMobile?: string;
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

  // Rate-limit dimensions: per-customer stops a compromised session
  // from spamming; per-IP catches a botnet using one account across
  // many boxes. Legitimate users book a handful a day at most.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
  const custCheck = await checkAndIncrement(
    LIMITS.booking_create_per_customer,
    "book_cust",
    String(auth.id),
  );
  if (!custCheck.ok) {
    return fail(429, "Too many booking attempts. Wait an hour and try again.", "RATE_LIMITED");
  }
  const ipCheck = await checkAndIncrement(LIMITS.booking_create_per_ip, "book_ip", ip);
  if (!ipCheck.ok) {
    return fail(429, "Too many booking attempts from this network.", "RATE_LIMITED");
  }

  try {
    const booking = await createCustomerBooking({
      customer: auth,
      clinicSlug: body.clinicSlug,
      slotIso: body.slotIso,
      reason: body.reason?.trim() || null,
      isNew: body.isNew ?? false,
      guestName: body.guestName ?? null,
      guestMobile: body.guestMobile ?? null,
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
        case "APP_BOOKINGS_OFF":
        case "SERVICE_NOT_BOOKABLE":
          return ERRORS.CONFLICT(err.message, err.code);
        case "NOT_FOUND":
          return ERRORS.NOT_FOUND(err.message);
        case "BAD_REQUEST":
          return ERRORS.BAD_REQUEST(err.message);
      }
    }
    console.error("createCustomerBooking failed", err);
    // Surface the underlying error inline when DEV_AUTH_ENABLED is on so
    // we don't need Vercel function logs to debug. Stripped automatically
    // when the env flag is off in prod.
    if (process.env.DEV_AUTH_ENABLED === "true") {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 4) : undefined;
      return Response.json(
        { ok: false, error: "Something went wrong.", code: "SERVER", debug: { msg, stack } },
        { status: 500 },
      );
    }
    return ERRORS.SERVER();
  }
}
