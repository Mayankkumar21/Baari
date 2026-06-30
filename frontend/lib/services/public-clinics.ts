// Read-only services for customer-app endpoints. Only ever returns
// clinics where publicListing = true. Keeps the surface small + the
// per-clinic isolation airtight (we never expose patient/booking
// details across clinic boundaries here).

import { and, asc, desc, eq, ilike, inArray, max, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { availableSlots, enumerateSlots, takenSlots } from "@/lib/services/booking";
import { isClosedDay } from "@/lib/services/booking-request";
import { servicesFor } from "@/lib/services/service-types";
import { clinicToday } from "@/lib/time";
import type { Clinic } from "@/lib/db/schema";

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
const DAY_KEYS: readonly DayKey[] = [
  "sun", "mon", "tue", "wed", "thu", "fri", "sat",
];

type OpeningBlock = {
  open?: string;
  close?: string;
  open2?: string;
  close2?: string;
  closed?: boolean;
};

export type PublicClinicSummary = {
  slug: string;
  name: string;
  tenantType: string;
  address: string | null;
  city: string | null;
  openNow: boolean;
  // ISO of the next bookable slot in the next 7 days, or null if none.
  // The app uses this to render:
  //   openNow + nextSlotIso same day  → "Open · Next slot 10:30"
  //   openNow + nextSlotIso later day → "Open · Fully booked today"
  //   !openNow + nextSlotIso          → "Closed · Opens [day at time]"
  //   nextSlotIso null                → "No slots in the next 7 days"
  nextSlotIso: string | null;
};

export type PublicClinicDetail = PublicClinicSummary & {
  phone: string | null;
  services: string[];
  openingHours: Record<DayKey, OpeningBlock>;
  slotLengthMin: number;
};

export type PublicSlot = { iso: string };

// Walk up to LOOKAHEAD_DAYS days forward looking for the first open
// slot. Used to render "Next slot 10:30" / "Fully booked today" /
// "Opens [day at time]" on the discover list.
const LOOKAHEAD_DAYS = 7;

function addIstDays(dateStr: string, n: number): string {
  // dateStr is "YYYY-MM-DD" in IST. Anchor at noon IST so DST-less +05:30
  // arithmetic stays inside the same calendar day.
  const d = new Date(`${dateStr}T12:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function findNextSlot(clinic: Clinic): Promise<string | null> {
  const today = clinicToday();
  for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
    const dateStr = addIstDays(today, i);
    if (await isClosedDay(clinic.id, dateStr)) continue;
    const taken = await takenSlots(clinic.id, dateStr);
    const slots = availableSlots(clinic, dateStr, taken);
    // availableSlots already filters out past + taken slots, so the
    // first entry is the earliest bookable time on this date.
    if (slots.length > 0) return slots[0];
  }
  return null;
}

async function summary(c: Clinic): Promise<PublicClinicSummary> {
  return {
    slug: c.slug ?? "",
    name: c.name,
    tenantType: c.tenantType ?? "clinic",
    address: c.address ?? null,
    city: c.city ?? null,
    openNow: isOpenAt(c, new Date()),
    nextSlotIso: await findNextSlot(c),
  };
}

export async function searchPublicClinics(args: {
  q?: string;
  tenantType?: string;
  limit?: number;
}): Promise<PublicClinicSummary[]> {
  const limit = Math.min(args.limit ?? 25, 50);

  const conditions = [
    eq(schema.clinics.publicListing, true),
    sql`${schema.clinics.slug} IS NOT NULL`,
  ];

  if (args.tenantType) {
    conditions.push(eq(schema.clinics.tenantType, args.tenantType));
  }

  const q = args.q?.trim();
  if (q && q.length >= 2) {
    const like = `%${q}%`;
    conditions.push(
      or(
        ilike(schema.clinics.name, like),
        ilike(schema.clinics.slug, like),
        ilike(schema.clinics.city, like),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(schema.clinics)
    .where(and(...conditions))
    .orderBy(asc(schema.clinics.name))
    .limit(limit);

  return Promise.all(rows.map(summary));
}

// "Featured" is a placeholder for the future "Near you" / curated list.
// For now: most-recently-active public clinics with at least one booking
// in the last 30 days, falling back to recently-created.
export async function featuredPublicClinics(
  limit = 10,
): Promise<PublicClinicSummary[]> {
  const limitN = Math.min(limit, 50);
  const rows = await db
    .select()
    .from(schema.clinics)
    .where(
      and(
        eq(schema.clinics.publicListing, true),
        sql`${schema.clinics.slug} IS NOT NULL`,
      ),
    )
    .orderBy(desc(schema.clinics.createdAt))
    .limit(limitN);
  return Promise.all(rows.map(summary));
}

// "Your places" — distinct clinics this customer has booked at,
// ordered by most-recent booking. Limited to MAX_RECENT entries so the
// section never balloons. Skips clinics that have since turned off
// publicListing (a customer shouldn't be able to navigate to a clinic
// the owner removed from discovery).
const MAX_RECENT = 5;

export async function recentPublicClinicsForCustomer(
  customerId: number,
): Promise<PublicClinicSummary[]> {
  const recent = await db
    .select({
      clinicId: schema.bookings.clinicId,
      lastSeen: max(schema.bookings.createdAt),
    })
    .from(schema.bookings)
    .innerJoin(
      schema.patients,
      eq(schema.bookings.patientId, schema.patients.id),
    )
    .where(eq(schema.patients.customerId, customerId))
    .groupBy(schema.bookings.clinicId)
    .orderBy(desc(max(schema.bookings.createdAt)))
    .limit(MAX_RECENT);

  if (recent.length === 0) return [];

  const ids = recent.map((r) => r.clinicId);
  const clinics = await db
    .select()
    .from(schema.clinics)
    .where(
      and(
        inArray(schema.clinics.id, ids),
        eq(schema.clinics.publicListing, true),
        sql`${schema.clinics.slug} IS NOT NULL`,
      ),
    );

  // Preserve recency order from the bookings query.
  const byId = new Map(clinics.map((c) => [c.id, c]));
  const ordered = recent
    .map((r) => byId.get(r.clinicId))
    .filter((c): c is Clinic => Boolean(c));
  return Promise.all(ordered.map(summary));
}

export async function getPublicClinicBySlug(
  slug: string,
): Promise<PublicClinicDetail | null> {
  if (!slug || slug.length > 80) return null;
  const [row] = await db
    .select()
    .from(schema.clinics)
    .where(and(eq(schema.clinics.slug, slug), eq(schema.clinics.publicListing, true)))
    .limit(1);
  if (!row) return null;
  const openingHours = (row.openingHours as Record<DayKey, OpeningBlock>) ?? {};
  const base = await summary(row);
  return {
    ...base,
    phone: row.phone ?? null,
    services: servicesFor(row.tenantType ?? "clinic"),
    openingHours,
    slotLengthMin: row.slotLengthMin ?? 20,
  };
}

// Returns ONLY open slots — past + taken stripped server-side so the
// app never sees them.
export async function getPublicSlots(args: {
  slug: string;
  date: string;
}): Promise<PublicSlot[] | null> {
  const [clinic] = await db
    .select()
    .from(schema.clinics)
    .where(
      and(
        eq(schema.clinics.slug, args.slug),
        eq(schema.clinics.publicListing, true),
      ),
    )
    .limit(1);
  if (!clinic) return null;
  if (await isClosedDay(clinic.id, args.date)) return [];
  const taken = await takenSlots(clinic.id, args.date);
  return enumerateSlots(clinic, args.date, taken)
    .filter((s) => s.status === "open")
    .map((s) => ({ iso: s.iso }));
}

// True if `now` falls inside one of the clinic's opening windows for
// today (handles single-shift and split-shift days).
function isOpenAt(clinic: Clinic, now: Date): boolean {
  const hours = (clinic.openingHours as Record<DayKey, OpeningBlock>) ?? {};
  const tz = "Asia/Kolkata";
  const today = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const dayKey = DAY_KEYS[today.getDay()];
  const block = hours[dayKey];
  if (!block || block.closed) return false;
  const minutes = today.getHours() * 60 + today.getMinutes();
  const inside = (open?: string, close?: string) => {
    if (!open || !close) return false;
    const [oh, om] = open.split(":").map(Number);
    const [ch, cm] = close.split(":").map(Number);
    return minutes >= oh * 60 + om && minutes < ch * 60 + cm;
  };
  return inside(block.open, block.close) || inside(block.open2, block.close2);
}

// Used by the booking endpoint to upsert a clinic-scoped patient row
// from a customer-app booking.
export async function getClinicBySlugInternal(slug: string): Promise<Clinic | null> {
  const [row] = await db
    .select()
    .from(schema.clinics)
    .where(eq(schema.clinics.slug, slug))
    .limit(1);
  return row ?? null;
}
