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

export type SlotStatus = "open" | "taken" | "past";
export type SlotInfo = { iso: string; status: SlotStatus };

// Returns EVERY slot in today's opening hours, with status. The booking form
// uses this to show greyed-out unavailable slots so the receptionist can see
// what's already booked instead of seeing a sparser grid.
//
// Day-of-week derivation: noon-IST → getUTCDay() returns the IST weekday
// (IST has no DST so the +05:30 offset is fixed year-round).
export function enumerateSlots(
  clinic: Clinic,
  on: string,
  taken: Set<string>,
): SlotInfo[] {
  const slotLen = clinic.slotLengthMin ?? 20;
  const hours = (clinic.openingHours as HoursDoc) ?? {};
  const onDate = new Date(`${on}T12:00:00+05:30`);
  const day = DAY_KEYS[onDate.getUTCDay()];
  const block = hours[day];
  const now = nowUtc();
  if (!block || block.closed || !block.open || !block.close) return [];

  let cursor = combineDateTime(on, block.open);
  const end = combineDateTime(on, block.close);
  const out: SlotInfo[] = [];
  while (cursor < end) {
    const iso = cursor.toISOString();
    const past = cursor.getTime() < now.getTime() - 5 * 60 * 1000;
    const status: SlotStatus = past ? "past" : taken.has(iso) ? "taken" : "open";
    out.push({ iso, status });
    cursor = new Date(cursor.getTime() + slotLen * 60 * 1000);
  }
  return out;
}

// Open-slots-only view, kept for walk-in / reschedule popovers.
export function availableSlots(clinic: Clinic, on: string, taken: Set<string>): string[] {
  return enumerateSlots(clinic, on, taken)
    .filter((s) => s.status === "open")
    .map((s) => s.iso);
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
  if (!mobile) throw new BookingError("Enter a valid Indian mobile (10 digits, starting with 6, 7, 8 or 9).");
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

// Walk-in: receptionist takes a customer who's standing in front of them.
// Auto-pick the next open slot today; default party_size 1; reason "Walk-in".
// On creation we immediately flip to checked_in so the receptionist doesn't
// need a separate click — walk-ins are already physically present.
export async function createWalkIn(args: {
  clinic: Clinic;
  createdByUserId: number;
  name: string;
  mobile: string;
}): Promise<Booking> {
  const name = args.name.trim();
  if (!name || name.length > 80) throw new BookingError("Name is required (max 80 characters).");
  const mobile = normalizeMobile(args.mobile);
  if (!mobile) throw new BookingError("Enter a valid Indian mobile (10 digits, starting with 6, 7, 8 or 9).");

  const on = clinicToday();
  const taken = await takenSlots(args.clinic.id, on);
  const slots = availableSlots(args.clinic, on, taken);
  if (slots.length === 0) {
    throw new BookingError("No open slots today. Adjust opening hours or try tomorrow.");
  }
  const slotTime = new Date(slots[0]);

  const patient = await upsertPatient(args.clinic.id, name, mobile, false, false);
  const token = await nextToken(args.clinic.id, on);
  const [booking] = await db
    .insert(schema.bookings)
    .values({
      clinicId: args.clinic.id,
      patientId: patient.id,
      date: on,
      token,
      slotTime,
      reason: "Walk-in",
      partySize: 1,
      status: "checked_in",
      checkedInAt: nowUtc(),
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
