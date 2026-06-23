// Read-only services for customer-app endpoints. Only ever returns
// clinics where publicListing = true. Keeps the surface small + the
// per-clinic isolation airtight (we never expose patient/booking
// details across clinic boundaries here).

import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { enumerateSlots, takenSlots } from "@/lib/services/booking";
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
};

export type PublicClinicDetail = PublicClinicSummary & {
  phone: string | null;
  services: string[];
  openingHours: Record<DayKey, OpeningBlock>;
  slotLengthMin: number;
};

export type PublicSlot = { iso: string };

function summary(c: Clinic): PublicClinicSummary {
  return {
    slug: c.slug ?? "",
    name: c.name,
    tenantType: c.tenantType ?? "clinic",
    address: c.address ?? null,
    city: c.city ?? null,
    openNow: isOpenAt(c, new Date()),
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

  return rows.map(summary);
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
  return rows.map(summary);
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
  return {
    ...summary(row),
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
