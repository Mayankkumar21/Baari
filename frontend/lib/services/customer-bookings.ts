// Customer-app booking service. Sits on top of the existing booking
// + queue services and adds:
//
//   • customer → patient upsert (per-clinic) using customer.mobile
//   • 2-active-bookings cap enforced per (mobile, clinic) — same rule
//     as the web /b/[token] flow
//   • transaction-safe slot re-check to dodge races between two app
//     users picking the same slot
//
// Returns clinic-rich response shapes so the app doesn't need a
// separate fetch per booking.

import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { nowUtc, clinicToday } from "@/lib/time";
import { takenSlots, nextToken } from "@/lib/services/booking";
import { ACTIVE_BOOKING_CAP } from "@/lib/services/booking-request";
import type { Customer } from "@/lib/db/schema";

export class CustomerBookingError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export type CustomerBookingRow = {
  id: number;
  token: number;
  slotIso: string;
  status: string;
  // Flat fields — kept for backwards compatibility with code that
  // reads the legacy shape.
  clinicSlug: string;
  clinicName: string;
  clinicAddress: string | null;
  clinicTenantType: string;
  clinicPhone: string | null;
  // Nested object — what the mobile app expects (booking.clinic.tenantType
  // etc.). Same data, just structured the way most REST APIs do related
  // entities.
  clinic: {
    slug: string;
    name: string;
    address: string | null;
    tenantType: string;
    phone: string | null;
  };
  reason: string | null;
  // Third-party booking — populated when the customer booked on someone
  // else's behalf. UI renders "For {guestName}" under the service row.
  guestName: string | null;
  guestMobile: string | null;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Indian mobile format used across the customer app + backend.
const GUEST_MOBILE_RE = /^[6-9]\d{9}$/;

export async function createCustomerBooking(args: {
  customer: Customer;
  clinicSlug: string;
  slotIso: string;
  reason?: string | null;
  isNew?: boolean;
  // Optional third-party fields. If guestName is non-empty after trim,
  // the booking is stored as a guest booking. guestMobile is validated
  // against the Indian format when non-empty; blank string → null.
  guestName?: string | null;
  guestMobile?: string | null;
  // "Coming together" group size. Route validates+clamps; service
  // accepts any int and stores it. Default 1 keeps existing solo flow.
  partySize?: number;
}): Promise<CustomerBookingRow> {
  if (!args.customer.mobile) {
    throw new CustomerBookingError(
      "MOBILE_REQUIRED",
      "Add a mobile to your profile first.",
    );
  }

  const slotTime = new Date(args.slotIso);
  if (Number.isNaN(slotTime.getTime())) {
    throw new CustomerBookingError("BAD_REQUEST", "Pick a valid time.");
  }

  // Find the clinic (must be publicly listed — the customer can only
  // book at clinics that opted in).
  const [clinic] = await db
    .select()
    .from(schema.clinics)
    .where(
      and(
        eq(schema.clinics.slug, args.clinicSlug),
        eq(schema.clinics.publicListing, true),
      ),
    )
    .limit(1);
  if (!clinic) {
    throw new CustomerBookingError("NOT_FOUND", "Clinic not found or not public.");
  }
  // Safety valve — the clinic can pause app bookings without going
  // fully unlisted. Uses a NOT_FOUND-ish 409 code so the app shows a
  // clean "not accepting bookings" message rather than a hard error.
  if (!clinic.acceptAppBookings) {
    throw new CustomerBookingError(
      "APP_BOOKINGS_OFF",
      "This clinic isn't accepting app bookings right now.",
    );
  }
  // Reason-guard against a stale app that offers a service the owner
  // has since removed from the allowlist. Client filters proactively,
  // this is the server-side safety net.
  const allowedServices = clinic.bookableServices as string[] | null;
  const reasonTrimmed = args.reason?.trim() || null;
  if (allowedServices && reasonTrimmed && !allowedServices.includes(reasonTrimmed)) {
    throw new CustomerBookingError(
      "SERVICE_NOT_BOOKABLE",
      "That service isn't bookable through the app right now.",
    );
  }

  const mobile = args.customer.mobile;
  const customerName = args.customer.name;
  const date = formatDate(slotTime);

  // Normalize + validate guest fields (kept together so the invariant
  // "guestMobile requires guestName" lives in one place).
  const guestName = args.guestName?.trim() || null;
  const guestMobileRaw = args.guestMobile?.trim() || "";
  const guestMobile = guestMobileRaw || null;
  if (guestMobile && !GUEST_MOBILE_RE.test(guestMobile)) {
    throw new CustomerBookingError(
      "BAD_REQUEST",
      "Guest mobile must be a 10-digit Indian number.",
    );
  }
  if (guestMobile && !guestName) {
    throw new CustomerBookingError(
      "BAD_REQUEST",
      "Add the person's name if you're booking on their behalf.",
    );
  }

  // Race-safety note: this used to run inside db.transaction(...), but
  // postgres-js's transactions hang on Vercel serverless + Neon for
  // reasons we haven't fully diagnosed. Rewritten as sequential ops
  // protected by:
  //   • The patients (clinic_id, mobile) unique index → safe upsert
  //   • The bookings (clinic_id, date, token) unique index → catches
  //     concurrent token collisions, we retry with nextToken()
  //   • The bookings (clinic_id, slot_time) partial unique index (WHERE
  //     status IN booked/checked_in/in_consult) → catches concurrent
  //     bookings for the same slot; we surface SLOT_TAKEN.
  //   • The cap check has a narrow race window (worst case: one extra
  //     booking past the cap per burst) — acceptable at pilot scale.

  // 1. Active-bookings cap.
  const active = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .innerJoin(
      schema.patients,
      eq(schema.bookings.patientId, schema.patients.id),
    )
    .where(
      and(
        eq(schema.bookings.clinicId, clinic.id),
        eq(schema.patients.mobile, mobile),
        inArray(schema.bookings.status, [
          "booked",
          "checked_in",
          "in_consult",
        ]),
      ),
    );
  if (active.length >= ACTIVE_BOOKING_CAP) {
    throw new CustomerBookingError(
      "CAP_REACHED",
      `You already have ${ACTIVE_BOOKING_CAP} active bookings here. Cancel one to add another.`,
    );
  }

  // 2. Slot-still-open check.
  const taken = await takenSlots(clinic.id, date);
  if (taken.has(slotTime.toISOString())) {
    throw new CustomerBookingError(
      "SLOT_TAKEN",
      "That time was just taken — pick another.",
    );
  }

  // 3. Upsert patient via ON CONFLICT on the (clinic_id, mobile) unique
  //    index. Always returns the row whether it was inserted or
  //    pre-existed. Single roundtrip.
  //
  //    customerId links this patient row to the customer-app account so
  //    a future mobile-change on the customer cascades here. On
  //    conflict we also CLAIM the row (set customer_id) — handles the
  //    case where a patient was first created via missed-call / dashboard
  //    walk-in and is now being identified by the app for the first time.
  const [patient] = await db
    .insert(schema.patients)
    .values({
      clinicId: clinic.id,
      name: customerName,
      mobile,
      isNew: args.isNew ?? true,
      whatsappOptOut: false,
      customerId: args.customer.id,
    })
    .onConflictDoUpdate({
      target: [schema.patients.clinicId, schema.patients.mobile],
      set: {
        name: customerName,
        customerId: args.customer.id,
      },
    })
    .returning();
  if (patient.anonymizedAt) {
    throw new CustomerBookingError(
      "ANONYMISED",
      "This contact has been removed by the business.",
    );
  }
  const patientId = patient.id;

  // 4. Owner-of-record for the booking (the clinic's doctor user).
  const [owner] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.clinicId, clinic.id),
        eq(schema.users.role, "doctor"),
      ),
    )
    .limit(1);
  if (!owner) {
    throw new CustomerBookingError(
      "NOT_FOUND",
      "Clinic owner not found — please contact support.",
    );
  }

  // 5. Insert booking with token-collision retry. nextToken() races
  //    against parallel requests; if we lose, the unique
  //    (clinic_id, date, token) index throws and we try again with a
  //    fresh max+1. Bounded to 5 attempts.
  let booking: typeof schema.bookings.$inferSelect | undefined;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const token = await nextToken(clinic.id, date);
      const [inserted] = await db
        .insert(schema.bookings)
        .values({
          clinicId: clinic.id,
          patientId,
          date,
          token,
          slotTime,
          reason: args.reason ?? null,
          guestName,
          guestMobile,
          partySize: args.partySize && args.partySize > 1 ? args.partySize : 1,
          status: "booked",
          source: "app",
          createdByUserId: owner.id,
        })
        .returning();
      booking = inserted;
      break;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Unique violation on the slot partial index → someone else took
      // this slot in the same millisecond we did. Surface a clean
      // SLOT_TAKEN instead of retrying, since another attempt won't help.
      if (/uq_bookings_clinic_slot_live/i.test(msg)) {
        throw new CustomerBookingError(
          "SLOT_TAKEN",
          "That time was just taken — pick another.",
        );
      }
      // Unique violation on (clinic_id, date, token) → token collision
      // with a parallel insert; retry with a fresh max+1.
      if (!/uq_bookings_clinic_date_token|duplicate key/i.test(msg)) throw err;
    }
  }
  if (!booking) {
    throw new CustomerBookingError(
      "NOT_FOUND",
      `Couldn't allocate a token after retries: ${
        lastErr instanceof Error ? lastErr.message : String(lastErr)
      }`,
    );
  }

  return {
    id: booking.id,
    token: booking.token,
    slotIso: new Date(booking.slotTime).toISOString(),
    status: booking.status,
    clinicSlug: clinic.slug!,
    clinicName: clinic.name,
    clinicAddress: clinic.address ?? null,
    clinicTenantType: clinic.tenantType ?? "clinic",
    clinicPhone: clinic.phone ?? null,
    clinic: {
      slug: clinic.slug!,
      name: clinic.name,
      address: clinic.address ?? null,
      tenantType: clinic.tenantType ?? "clinic",
      phone: clinic.phone ?? null,
    },
    reason: booking.reason ?? null,
    guestName: booking.guestName ?? null,
    guestMobile: booking.guestMobile ?? null,
    createdAt: new Date(booking.createdAt).toISOString(),
    completedAt: null,
    cancelledAt: null,
  };
}

export async function listCustomerBookings(customer: Customer) {
  if (!customer.mobile) {
    return { active: [], past: [] };
  }
  const rows = await db
    .select({
      id: schema.bookings.id,
      token: schema.bookings.token,
      slotTime: schema.bookings.slotTime,
      status: schema.bookings.status,
      reason: schema.bookings.reason,
      guestName: schema.bookings.guestName,
      guestMobile: schema.bookings.guestMobile,
      createdAt: schema.bookings.createdAt,
      completedAt: schema.bookings.completedAt,
      cancelledAt: schema.bookings.cancelledAt,
      clinicSlug: schema.clinics.slug,
      clinicName: schema.clinics.name,
      clinicAddress: schema.clinics.address,
      clinicTenantType: schema.clinics.tenantType,
      clinicPhone: schema.clinics.phone,
    })
    .from(schema.bookings)
    .innerJoin(schema.patients, eq(schema.bookings.patientId, schema.patients.id))
    .innerJoin(schema.clinics, eq(schema.bookings.clinicId, schema.clinics.id))
    .where(eq(schema.patients.mobile, customer.mobile))
    .orderBy(desc(schema.bookings.slotTime))
    .limit(100);

  const active: CustomerBookingRow[] = [];
  const past: CustomerBookingRow[] = [];
  for (const r of rows) {
    const row: CustomerBookingRow = {
      id: r.id,
      token: r.token,
      slotIso: new Date(r.slotTime).toISOString(),
      status: r.status,
      reason: r.reason ?? null,
      guestName: r.guestName ?? null,
      guestMobile: r.guestMobile ?? null,
      clinicSlug: r.clinicSlug ?? "",
      clinicName: r.clinicName,
      clinicAddress: r.clinicAddress ?? null,
      clinicTenantType: r.clinicTenantType ?? "clinic",
      clinicPhone: r.clinicPhone ?? null,
      clinic: {
        slug: r.clinicSlug ?? "",
        name: r.clinicName,
        address: r.clinicAddress ?? null,
        tenantType: r.clinicTenantType ?? "clinic",
        phone: r.clinicPhone ?? null,
      },
      createdAt: new Date(r.createdAt).toISOString(),
      completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
      cancelledAt: r.cancelledAt ? new Date(r.cancelledAt).toISOString() : null,
    };
    if (r.status === "booked" || r.status === "checked_in" || r.status === "in_consult") {
      active.push(row);
    } else {
      past.push(row);
    }
  }
  return { active, past };
}

// Booking-scoped resolution — uses both bookingId AND customer.mobile so
// one customer can never read another's booking by guessing IDs.
export async function getCustomerBooking(
  customer: Customer,
  bookingId: number,
): Promise<CustomerBookingRow | null> {
  if (!customer.mobile) return null;
  const [row] = await db
    .select({
      id: schema.bookings.id,
      token: schema.bookings.token,
      slotTime: schema.bookings.slotTime,
      status: schema.bookings.status,
      reason: schema.bookings.reason,
      guestName: schema.bookings.guestName,
      guestMobile: schema.bookings.guestMobile,
      createdAt: schema.bookings.createdAt,
      completedAt: schema.bookings.completedAt,
      cancelledAt: schema.bookings.cancelledAt,
      clinicSlug: schema.clinics.slug,
      clinicName: schema.clinics.name,
      clinicAddress: schema.clinics.address,
      clinicTenantType: schema.clinics.tenantType,
      clinicPhone: schema.clinics.phone,
    })
    .from(schema.bookings)
    .innerJoin(schema.patients, eq(schema.bookings.patientId, schema.patients.id))
    .innerJoin(schema.clinics, eq(schema.bookings.clinicId, schema.clinics.id))
    .where(
      and(
        eq(schema.bookings.id, bookingId),
        eq(schema.patients.mobile, customer.mobile),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    token: row.token,
    slotIso: new Date(row.slotTime).toISOString(),
    status: row.status,
    reason: row.reason ?? null,
    guestName: row.guestName ?? null,
    guestMobile: row.guestMobile ?? null,
    clinicSlug: row.clinicSlug ?? "",
    clinicName: row.clinicName,
    clinicAddress: row.clinicAddress ?? null,
    clinicTenantType: row.clinicTenantType ?? "clinic",
    clinicPhone: row.clinicPhone ?? null,
    clinic: {
      slug: row.clinicSlug ?? "",
      name: row.clinicName,
      address: row.clinicAddress ?? null,
      tenantType: row.clinicTenantType ?? "clinic",
      phone: row.clinicPhone ?? null,
    },
    createdAt: new Date(row.createdAt).toISOString(),
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    cancelledAt: row.cancelledAt ? new Date(row.cancelledAt).toISOString() : null,
  };
}

export async function cancelCustomerBooking(args: {
  customer: Customer;
  bookingId: number;
  reason?: string;
}) {
  if (!args.customer.mobile) {
    throw new CustomerBookingError(
      "MOBILE_REQUIRED",
      "Add a mobile to your profile first.",
    );
  }

  // Two sequential queries instead of a txn — the cancel is a single
  // status flip and we already enforce ownership via the patient.mobile
  // join, so there's no race window worth a transaction.
  const [row] = await db
    .select({
      id: schema.bookings.id,
      status: schema.bookings.status,
      patientMobile: schema.patients.mobile,
    })
    .from(schema.bookings)
    .innerJoin(
      schema.patients,
      eq(schema.bookings.patientId, schema.patients.id),
    )
    .where(eq(schema.bookings.id, args.bookingId))
    .limit(1);
  if (!row || row.patientMobile !== args.customer.mobile) {
    throw new CustomerBookingError("NOT_FOUND", "Booking not found.");
  }
  if (row.status === "cancelled") return; // idempotent
  if (row.status === "done") {
    throw new CustomerBookingError(
      "ALREADY_DONE",
      "This booking is already complete.",
    );
  }
  if (row.status === "in_consult") {
    throw new CustomerBookingError(
      "IN_SESSION",
      "You're already in session — ask the front desk to cancel.",
    );
  }
  const now = nowUtc();
  await db
    .update(schema.bookings)
    .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
    .where(eq(schema.bookings.id, args.bookingId));
}
