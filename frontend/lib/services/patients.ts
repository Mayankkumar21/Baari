// Patient lookups + addGuest (creates a patient with no booking attached —
// useful when the receptionist takes down contact info for an enquiry).
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { normalizeMobile } from "@/lib/auth";
import type { Patient } from "@/lib/db/schema";

export class PatientError extends Error {}

export type GuestRow = {
  id: number;
  name: string;
  mobile: string;
  noShowCount: number;
  isNew: boolean;
  lastVisitAt: string | null;
  lastReason: string | null;
};

// Returns the last `limit` patients seen at this clinic, ordered by most
// recent activity. We coalesce the latest booking's slot_time with
// patients.created_at so guests added via "+ Add guest" (no bookings yet)
// still show up near the top.
export async function getRecentGuests(
  clinicId: number,
  limit = 12,
): Promise<GuestRow[]> {
  const rows = await db
    .select({
      id: schema.patients.id,
      name: schema.patients.name,
      mobile: schema.patients.mobile,
      noShowCount: schema.patients.noShowCount,
      isNew: schema.patients.isNew,
      createdAt: schema.patients.createdAt,
      lastSlot: sql<Date | null>`max(${schema.bookings.slotTime})`,
      lastReason: sql<
        string | null
      >`(array_agg(${schema.bookings.reason} order by ${schema.bookings.slotTime} desc) filter (where ${schema.bookings.reason} is not null))[1]`,
    })
    .from(schema.patients)
    .leftJoin(
      schema.bookings,
      and(
        eq(schema.bookings.patientId, schema.patients.id),
        eq(schema.bookings.clinicId, clinicId),
      ),
    )
    .where(eq(schema.patients.clinicId, clinicId))
    .groupBy(schema.patients.id)
    .orderBy(
      desc(sql`coalesce(max(${schema.bookings.slotTime}), ${schema.patients.createdAt})`),
    )
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    mobile: r.mobile,
    noShowCount: r.noShowCount,
    isNew: r.isNew,
    lastVisitAt: r.lastSlot ? new Date(r.lastSlot).toISOString() : null,
    lastReason: r.lastReason,
  }));
}

export async function addGuest(args: {
  clinicId: number;
  name: string;
  mobile: string;
  whatsappOptOut?: boolean;
}): Promise<Patient> {
  const name = (args.name ?? "").trim();
  if (!name || name.length > 80) {
    throw new PatientError("Name is required (max 80 characters).");
  }
  const mobile = normalizeMobile(args.mobile);
  if (!mobile) {
    throw new PatientError("Enter a valid mobile number.");
  }

  // Idempotent — if a patient with this mobile already exists, return them
  // rather than failing on the unique constraint. The receptionist's
  // intent ("get this person on file") is satisfied either way.
  const [existing] = await db
    .select()
    .from(schema.patients)
    .where(
      and(eq(schema.patients.clinicId, args.clinicId), eq(schema.patients.mobile, mobile)),
    )
    .limit(1);
  if (existing) {
    if (existing.anonymizedAt) {
      throw new PatientError("This patient record has been anonymized.");
    }
    if (existing.name !== name) {
      const [updated] = await db
        .update(schema.patients)
        .set({ name })
        .where(eq(schema.patients.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }

  const [created] = await db
    .insert(schema.patients)
    .values({
      clinicId: args.clinicId,
      name,
      mobile,
      isNew: true,
      whatsappOptOut: args.whatsappOptOut ?? false,
    })
    .returning();
  return created;
}

// Full customer profile — counts + last visit + every booking. Used by the
// /search/[mobile] page so clicking a guest opens a real customer card, not
// just one repeated booking row.
export type CustomerBooking = {
  id: number;
  token: number;
  slotTime: string;
  reason: string | null;
  status: string;
  durationSec: number | null;
};

export type CustomerProfile = {
  id: number;
  name: string;
  mobile: string;
  noShowCount: number;
  isNew: boolean;
  whatsappOptOut: boolean;
  createdAt: string;
  // Derived: total non-cancelled bookings ever made for this patient at this
  // clinic. Cancellations don't count as "visits" by any owner's definition.
  totalVisits: number;
  completedVisits: number;
  lastVisitAt: string | null;
  // Heuristic: we don't store a language preference column yet, so we infer
  // "हिन्दी" from any Devanagari codepoint in the name (Unicode 0900-097F)
  // and fall back to "English" otherwise. Good enough until consent capture
  // lands.
  languagePreference: "हिन्दी" | "English";
  bookings: CustomerBooking[];
};

const DEVANAGARI_RE = /[ऀ-ॿ]/;

export async function getCustomerProfile(
  clinicId: number,
  mobileRaw: string,
): Promise<CustomerProfile | null> {
  const mobile = normalizeMobile(mobileRaw);
  if (!mobile) return null;

  const [patient] = await db
    .select()
    .from(schema.patients)
    .where(and(eq(schema.patients.clinicId, clinicId), eq(schema.patients.mobile, mobile)))
    .limit(1);
  if (!patient || patient.anonymizedAt) return null;

  const bookings = await db
    .select({
      id: schema.bookings.id,
      token: schema.bookings.token,
      slotTime: schema.bookings.slotTime,
      reason: schema.bookings.reason,
      status: schema.bookings.status,
      startedAt: schema.bookings.startedAt,
      completedAt: schema.bookings.completedAt,
    })
    .from(schema.bookings)
    .where(
      and(eq(schema.bookings.clinicId, clinicId), eq(schema.bookings.patientId, patient.id)),
    )
    .orderBy(desc(schema.bookings.slotTime));

  const totalVisits = bookings.filter((b) => b.status !== "cancelled").length;
  const completedVisits = bookings.filter((b) => b.status === "done").length;
  const lastDone = bookings.find((b) => b.status === "done");
  const lastVisitAt = lastDone ? new Date(lastDone.slotTime).toISOString() : null;

  return {
    id: patient.id,
    name: patient.name,
    mobile: patient.mobile,
    noShowCount: patient.noShowCount,
    isNew: patient.isNew,
    whatsappOptOut: patient.whatsappOptOut,
    createdAt: new Date(patient.createdAt).toISOString(),
    totalVisits,
    completedVisits,
    lastVisitAt,
    languagePreference: DEVANAGARI_RE.test(patient.name) ? "हिन्दी" : "English",
    bookings: bookings.map((b) => ({
      id: b.id,
      token: b.token,
      slotTime: new Date(b.slotTime).toISOString(),
      reason: b.reason,
      status: b.status,
      durationSec:
        b.startedAt && b.completedAt
          ? Math.round(
              (new Date(b.completedAt).getTime() - new Date(b.startedAt).getTime()) / 1000,
            )
          : null,
    })),
  };
}
