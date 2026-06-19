// Patient lookups + addGuest (creates a patient with no booking attached —
// useful when the receptionist takes down contact info for an enquiry).
import { and, desc, eq, max, sql } from "drizzle-orm";
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
    throw new PatientError("Enter a valid Indian mobile (10 digits, starting with 6, 7, 8 or 9).");
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
