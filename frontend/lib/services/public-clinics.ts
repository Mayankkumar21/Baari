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
import { mobileVocabFor } from "@/lib/vocab";
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
  // ISO of when the current open block ends — only set if openNow=true.
  // App renders: "Open now · Closes at 19:00".
  closesAtIso: string | null;
  // ISO of when the clinic next opens — only set if openNow=false.
  // App renders: "Closed · Opens at 15:00 today" / "...tomorrow 09:00"
  // / "...Mon 09:00". Null if no opening in the next 7 days.
  nextOpenIso: string | null;
  // Number of bookings in booked|checked_in for today (in_consult and
  // done are excluded — those aren't waiting). App renders a chip when
  // openNow=true: "3 waiting · ~45 min". Hide when 0 or closed.
  waitingNow: number;
  estWaitMinutes: number;
  // True when the authenticated customer already has a patient record
  // at this clinic (any prior booking, even not-yet-done). The confirm
  // sheet uses this to default "First visit?" off. Null-safe: false
  // when the caller isn't authed or the customer has no mobile.
  isReturning: boolean;
  // False when the owner has paused app bookings; the app disables the
  // Book CTA but still shows address / hours / phone so a direct-link
  // customer can call in.
  acceptAppBookings: boolean;
  // Upcoming YYYY-MM-DD dates the owner has explicitly marked closed
  // (holidays, staff leave). Distinct from the weekly openingHours
  // shape: those describe recurring days-of-week, these are one-off
  // dates. The mobile day picker uses this to skip closed dates
  // proactively instead of showing them and returning empty slots.
  // Capped at the next N days so the payload stays small.
  closedDates: string[];
  // Business-type-aware labels served alongside the clinic so the mobile
  // app doesn't drift from the dashboard's terminology. Backend is the
  // single source of truth; the mobile map is now fallback for older
  // builds.
  vocab: { sessionLabel: string; bookCta: string; tenantLabel: string };
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

// Cheap variant for list views: NO per-clinic slot lookup. `findNextSlot`
// fires up to 14 queries per clinic (7 days × isClosedDay + takenSlots),
// which multiplied by N clinics in featured/search turned discovery into
// a query-storm. List consumers get `nextSlotIso: null` and can fetch
// the real value from the detail endpoint if the user opens a card.
function summaryFast(c: Clinic): PublicClinicSummary {
  return {
    slug: c.slug ?? "",
    name: c.name,
    tenantType: c.tenantType ?? "clinic",
    address: c.address ?? null,
    city: c.city ?? null,
    openNow: isOpenAt(c, new Date()),
    nextSlotIso: null,
  };
}

// Detail-view variant: pays the slot-lookup cost. Used by
// `/api/v1/clinics/[slug]` where the caller is a single click, not a
// list scan.
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
    eq(schema.clinics.acceptAppBookings, true),
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

  return rows.map(summaryFast);
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
        eq(schema.clinics.acceptAppBookings, true),
        sql`${schema.clinics.slug} IS NOT NULL`,
      ),
    )
    .orderBy(desc(schema.clinics.createdAt))
    .limit(limitN);
  return rows.map(summaryFast);
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
        eq(schema.clinics.acceptAppBookings, true),
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
  customerMobile?: string | null,
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
  const now = new Date();
  const slotLen = row.slotLengthMin ?? 20;
  const waitingNow = await getWaitingNow(row.id);
  // A patient row is created on the customer's first booking here, so
  // "returning" == the row exists. The confirm sheet uses this to
  // default First visit? off. Cheap: single indexed lookup.
  let isReturning = false;
  if (customerMobile) {
    const [existing] = await db
      .select({ id: schema.patients.id })
      .from(schema.patients)
      .where(
        and(
          eq(schema.patients.clinicId, row.id),
          eq(schema.patients.mobile, customerMobile),
        ),
      )
      .limit(1);
    isReturning = !!existing;
  }
  // Apply the owner's bookable-services allowlist. `null` (default) means
  // the app sees the full service catalogue; an explicit array narrows
  // it. Empty array is possible when the owner has intentionally
  // disallowed every service — respected as-is (Book CTA will be off).
  const allServices = servicesFor(row.tenantType ?? "clinic");
  const allowed = row.bookableServices as string[] | null;
  const services = allowed
    ? allServices.filter((s) => allowed.includes(s))
    : allServices;

  // Upcoming closed dates (workspace-wide only for pilot — user_id
  // rows are ignored). Range matches the mobile picker's lookahead so
  // we don't ship more data than it can display.
  const todayIso = clinicToday();
  const horizon = addIstDays(todayIso, LOOKAHEAD_DAYS);
  const closedRows = await db
    .select({ date: schema.closedDays.date })
    .from(schema.closedDays)
    .where(
      sql`${schema.closedDays.clinicId} = ${row.id}
        AND ${schema.closedDays.date} >= ${todayIso}
        AND ${schema.closedDays.date} <= ${horizon}
        AND ${schema.closedDays.userId} IS NULL`,
    );
  const closedDates = closedRows.map((r) =>
    typeof r.date === "string" ? r.date : new Date(r.date).toISOString().slice(0, 10),
  );

  return {
    ...base,
    phone: row.phone ?? null,
    services,
    openingHours,
    slotLengthMin: slotLen,
    closesAtIso: getCurrentCloseTime(row, now),
    nextOpenIso: base.openNow ? null : await getNextOpenTime(row, now),
    waitingNow,
    estWaitMinutes: waitingNow * slotLen,
    isReturning,
    acceptAppBookings: row.acceptAppBookings,
    closedDates,
    vocab: mobileVocabFor(row.tenantType ?? "clinic"),
  };
}

// Counts today's bookings in pre-consult states. Excludes in_consult
// (currently being served, not waiting) and the terminal states. This
// is what the customer-app shows as "N waiting · ~M min" before they
// decide whether to book.
async function getWaitingNow(clinicId: number): Promise<number> {
  const today = clinicToday();
  const rows = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.clinicId, clinicId),
        eq(schema.bookings.date, today),
        inArray(schema.bookings.status, ["booked", "checked_in"] as const),
      ),
    );
  return rows.length;
}

// ─── Open/close time helpers ──────────────────────────────────────────
// Parses the openingHours JSON to give the customer-app a precise
// "closes at" (when openNow) or "opens at" (when closed). Logic mirrors
// isOpenAt — split-shift support, IST anchor, week lookahead.

function dayKeyFor(istDateStr: string): DayKey {
  const d = new Date(`${istDateStr}T12:00:00+05:30`);
  return DAY_KEYS[d.getUTCDay()];
}

function combineIstDateTime(istDateStr: string, hhmm: string): Date {
  return new Date(`${istDateStr}T${hhmm}:00+05:30`);
}

// If `now` falls inside one of today's opening blocks, return the close
// time of THAT block. Otherwise null.
function getCurrentCloseTime(clinic: Clinic, now: Date): string | null {
  const istToday = clinicToday();
  const hours = (clinic.openingHours as Record<DayKey, OpeningBlock>) ?? {};
  const block = hours[dayKeyFor(istToday)];
  if (!block || block.closed) return null;
  const tryBlock = (open?: string, close?: string): string | null => {
    if (!open || !close) return null;
    const openDt = combineIstDateTime(istToday, open);
    const closeDt = combineIstDateTime(istToday, close);
    if (now >= openDt && now < closeDt) return closeDt.toISOString();
    return null;
  };
  return tryBlock(block.open, block.close) ?? tryBlock(block.open2, block.close2);
}

// Walks up to 7 IST days forward looking for the next opening time
// AFTER `now`. Respects closed_days. Handles split shifts (afternoon
// block when morning is past). Returns null if no opening found in 7d.
async function getNextOpenTime(clinic: Clinic, now: Date): Promise<string | null> {
  const istToday = clinicToday();
  for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
    const istDate = addIstDays(istToday, i);
    if (await isClosedDay(clinic.id, istDate)) continue;
    const hours = (clinic.openingHours as Record<DayKey, OpeningBlock>) ?? {};
    const block = hours[dayKeyFor(istDate)];
    if (!block || block.closed) continue;
    // First block of the day
    if (block.open) {
      const openDt = combineIstDateTime(istDate, block.open);
      if (openDt > now) return openDt.toISOString();
    }
    // Second (afternoon) block — useful when we're between blocks today.
    if (block.open2) {
      const open2Dt = combineIstDateTime(istDate, block.open2);
      if (open2Dt > now) return open2Dt.toISOString();
    }
  }
  return null;
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
