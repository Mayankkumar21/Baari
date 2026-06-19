// Booking creation + slot picker. Port of app/services/booking_service.py.
// `openingHours` here uses the {day: {open, close}} shape produced by setup;
// build_slots expands that into 20-min cursor slots like the Python version.
import { and, eq, max, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { normalizeMobile } from "@/lib/auth";
import { clinicToday, combineDateTime, nowUtc } from "@/lib/time";
import type { Clinic, Patient, Booking } from "@/lib/db/schema";

export class BookingError extends Error {}

type DayBlock = { open?: string; close?: string; closed?: boolean };
type HoursDoc = Record<string, DayBlock>;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function availableSlots(clinic: Clinic, on: string, taken: Set<string>): string[] {
  // on = YYYY-MM-DD. Returns ISO strings of UTC slot times.
  const slotLen = clinic.slotLengthMin ?? 20;
  const hours = (clinic.openingHours as HoursDoc) ?? {};
  const onDate = new Date(`${on}T12:00:00+05:30`);
  const day = DAY_KEYS[onDate.getUTCDay()]; // UTC day in IST = same calendar day
  // Note: with IST being +05:30, onDate.getUTCDay() at noon IST returns the IST weekday.
  // The day index for a +05:30 noon would be the IST date's weekday — verified.
  const block = hours[day];
  const now = nowUtc();
  const slots: string[] = [];
  if (!block || block.closed || !block.open || !block.close) return slots;

  let cursor = combineDateTime(on, block.open);
  const end = combineDateTime(on, block.close);
  while (cursor < end) {
    const iso = cursor.toISOString();
    const past = cursor.getTime() < now.getTime() - 5 * 60 * 1000;
    if (!past && !taken.has(iso)) slots.push(iso);
    cursor = new Date(cursor.getTime() + slotLen * 60 * 1000);
  }
  return slots;
}

export async function takenSlots(clinicId: number, on: string): Promise<Set<string>> {
  const rows = await db
    .select({ slotTime: schema.bookings.slotTime })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.clinicId, clinicId),
        eq(schema.bookings.date, on),
        ne(schema.bookings.status, "cancelled"),
      ),
    );
  return new Set(rows.map((r) => r.slotTime.toISOString()));
}

export async function nextToken(clinicId: number, on: string): Promise<number> {
  const [row] = await db
    .select({ max: max(schema.bookings.token) })
    .from(schema.bookings)
    .where(and(eq(schema.bookings.clinicId, clinicId), eq(schema.bookings.date, on)));
  return (row?.max ?? 0) + 1;
}

async function upsertPatient(
  clinicId: number,
  name: string,
  mobile: string,
  isNew: boolean,
  whatsappOptOut: boolean,
): Promise<Patient> {
  const [existing] = await db
    .select()
    .from(schema.patients)
    .where(and(eq(schema.patients.clinicId, clinicId), eq(schema.patients.mobile, mobile)))
    .limit(1);
  if (existing) {
    if (existing.anonymizedAt) {
      throw new BookingError("This patient record has been anonymized and cannot be booked.");
    }
    if (existing.name !== name || existing.whatsappOptOut !== whatsappOptOut) {
      const [updated] = await db
        .update(schema.patients)
        .set({ name, whatsappOptOut })
        .where(eq(schema.patients.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }
  const [created] = await db
    .insert(schema.patients)
    .values({ clinicId, name, mobile, isNew, whatsappOptOut })
    .returning();
  return created;
}

export async function createBooking(args: {
  clinic: Clinic;
  createdByUserId: number;
  name: string;
  mobile: string;
  slotTime: Date;
  reason: string | null;
  isNew: boolean;
  partySize: number;
  whatsappOptOut: boolean;
}): Promise<Booking> {
  const name = args.name.trim();
  if (!name || name.length > 80) throw new BookingError("Name is required (max 80 characters).");
  const mobile = normalizeMobile(args.mobile);
  if (!mobile) throw new BookingError("Enter a valid 10-digit Indian mobile number.");
  if (args.partySize < 1 || args.partySize > 5)
    throw new BookingError("Party size must be between 1 and 5.");
  if (args.reason && args.reason.length > 200)
    throw new BookingError("Reason must be 200 characters or fewer.");

  const on = clinicToday();
  const taken = await takenSlots(args.clinic.id, on);
  if (taken.has(args.slotTime.toISOString())) {
    throw new BookingError("That slot was just taken. Please pick another.");
  }

  const patient = await upsertPatient(
    args.clinic.id,
    name,
    mobile,
    args.isNew,
    args.whatsappOptOut,
  );
  const token = await nextToken(args.clinic.id, on);
  const [booking] = await db
    .insert(schema.bookings)
    .values({
      clinicId: args.clinic.id,
      patientId: patient.id,
      date: on,
      token,
      slotTime: args.slotTime,
      reason: args.reason || null,
      partySize: args.partySize,
      status: "booked",
      createdByUserId: args.createdByUserId,
    })
    .returning();
  return booking;
}

export async function rescheduleBooking(args: {
  clinicId: number;
  bookingId: number;
  newSlotTime: Date;
}): Promise<Booking> {
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(
      and(eq(schema.bookings.id, args.bookingId), eq(schema.bookings.clinicId, args.clinicId)),
    )
    .limit(1);
  if (!booking) throw new BookingError("Booking not found.");
  if (
    booking.status === "done" ||
    booking.status === "no_show" ||
    booking.status === "cancelled" ||
    booking.status === "in_consult"
  ) {
    throw new BookingError(`Cannot reschedule a ${booking.status} booking.`);
  }
  if (args.newSlotTime.toISOString().slice(0, 10) !== booking.date) {
    throw new BookingError("Reschedule must stay on the same day.");
  }
  if (args.newSlotTime.getTime() === booking.slotTime.getTime()) {
    throw new BookingError("Pick a different slot.");
  }
  const taken = await takenSlots(args.clinicId, booking.date);
  taken.delete(booking.slotTime.toISOString()); // the current slot is the booking itself
  if (taken.has(args.newSlotTime.toISOString())) {
    throw new BookingError("That slot is already taken.");
  }
  const [updated] = await db
    .update(schema.bookings)
    .set({ slotTime: args.newSlotTime, updatedAt: nowUtc() })
    .where(eq(schema.bookings.id, args.bookingId))
    .returning();
  return updated;
}

export async function cancelBooking(args: {
  clinicId: number;
  bookingId: number;
}): Promise<Booking> {
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(
      and(eq(schema.bookings.id, args.bookingId), eq(schema.bookings.clinicId, args.clinicId)),
    )
    .limit(1);
  if (!booking) throw new BookingError("Booking not found.");
  if (booking.status === "done" || booking.status === "no_show" || booking.status === "cancelled") {
    throw new BookingError(`Booking is already ${booking.status}.`);
  }
  const now = nowUtc();
  const [updated] = await db
    .update(schema.bookings)
    .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
    .where(eq(schema.bookings.id, args.bookingId))
    .returning();
  return updated;
}
