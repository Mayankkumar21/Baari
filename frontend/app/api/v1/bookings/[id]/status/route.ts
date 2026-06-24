// GET /api/v1/bookings/:id/status — polled every 15s by the live-status
// screen. Cheap read: queue position + wait estimate + clinic display
// fields. Auth-gated; one customer can't peek at another's booking.

export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { ERRORS, ok, requireCustomer } from "@/lib/api-helpers";
import { getCustomerBooking } from "@/lib/services/customer-bookings";
import { queuePosition } from "@/lib/services/booking-request";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCustomer(req);
  if (auth instanceof Response) return auth;

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

  let estWaitMinutes: number | null = null;
  if (booking.status === "booked" || booking.status === "checked_in") {
    estWaitMinutes = Math.max(2, (pos?.position ?? 0) * slotLen);
  }

  return ok(
    {
      bookingId: booking.id,
      token: booking.token,
      status: booking.status,
      slotIso: booking.slotIso,
      position: pos?.position ?? 0,
      totalWaiting: pos?.totalWaiting ?? 0,
      estWaitMinutes,
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
