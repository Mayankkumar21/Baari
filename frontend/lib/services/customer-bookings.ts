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
  clinicSlug: string;
  clinicName: string;
  clinicAddress: string | null;
  reason: string | null;
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

export async function createCustomerBooking(args: {
  customer: Customer;
  clinicSlug: string;
  slotIso: string;
  reason?: string | null;
  isNew?: boolean;
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

  const mobile = args.customer.mobile;
  const customerName = args.customer.name;

  const result = await db.transaction(async (tx) => {
    // 1. Re-check active-bookings cap inside the txn.
    const active = await tx
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

    // 2. Re-check the slot is still open.
    const taken = await takenSlots(clinic.id, formatDate(slotTime));
    if (taken.has(slotTime.toISOString())) {
      throw new CustomerBookingError(
        "SLOT_TAKEN",
        "That time was just taken — pick another.",
      );
    }

    // 3. Upsert clinic-scoped patient.
    let patientId: number;
    const [existingPatient] = await tx
      .select()
      .from(schema.patients)
      .where(
        and(
          eq(schema.patients.clinicId, clinic.id),
          eq(schema.patients.mobile, mobile),
        ),
      )
      .limit(1);
    if (existingPatient) {
      if (existingPatient.anonymizedAt) {
        throw new CustomerBookingError(
          "ANONYMISED",
          "This contact has been removed by the business.",
        );
      }
      if (existingPatient.name !== customerName) {
        await tx
          .update(schema.patients)
          .set({ name: customerName })
          .where(eq(schema.patients.id, existingPatient.id));
      }
      patientId = existingPatient.id;
    } else {
      const [created] = await tx
        .insert(schema.patients)
        .values({
          clinicId: clinic.id,
          name: customerName,
          mobile,
          isNew: args.isNew ?? true,
          whatsappOptOut: false,
        })
        .returning();
      patientId = created.id;
    }

    // 4. Owner-of-record for the booking. The clinic's owner user is
    //    used because there isn't a "self" user for the customer side.
    const [owner] = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.clinicId, clinic.id),
          eq(schema.users.role, "doctor"),
        ),
      )
      .limit(1);

    // 5. Create the booking.
    const date = formatDate(slotTime);
    const token = await nextToken(clinic.id, date);
    const [booking] = await tx
      .insert(schema.bookings)
      .values({
        clinicId: clinic.id,
        patientId,
        date,
        token,
        slotTime,
        reason: args.reason ?? null,
        partySize: 1,
        status: "booked",
        createdByUserId: owner?.id ?? 0,
      })
      .returning();

    return { booking };
  });

  return {
    id: result.booking.id,
    token: result.booking.token,
    slotIso: new Date(result.booking.slotTime).toISOString(),
    status: result.booking.status,
    clinicSlug: clinic.slug!,
    clinicName: clinic.name,
    clinicAddress: clinic.address ?? null,
    reason: result.booking.reason ?? null,
    createdAt: new Date(result.booking.createdAt).toISOString(),
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
      createdAt: schema.bookings.createdAt,
      completedAt: schema.bookings.completedAt,
      cancelledAt: schema.bookings.cancelledAt,
      clinicSlug: schema.clinics.slug,
      clinicName: schema.clinics.name,
      clinicAddress: schema.clinics.address,
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
      clinicSlug: r.clinicSlug ?? "",
      clinicName: r.clinicName,
      clinicAddress: r.clinicAddress ?? null,
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
      createdAt: schema.bookings.createdAt,
      completedAt: schema.bookings.completedAt,
      cancelledAt: schema.bookings.cancelledAt,
      clinicSlug: schema.clinics.slug,
      clinicName: schema.clinics.name,
      clinicAddress: schema.clinics.address,
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
    clinicSlug: row.clinicSlug ?? "",
    clinicName: row.clinicName,
    clinicAddress: row.clinicAddress ?? null,
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

  return db.transaction(async (tx) => {
    const [row] = await tx
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
    await tx
      .update(schema.bookings)
      .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
      .where(eq(schema.bookings.id, args.bookingId));
  });
}
