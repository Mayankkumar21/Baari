// POST /api/v1/owner/queue/walkin — create a walk-in booking.
//
// Someone shows up at the counter without an existing booking. Same
// service the web dashboard's Walk-in button calls — auto-picks the
// next open slot today, creates the booking already in `checked_in`
// status (they're physically here), tags source: "walkin".

export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { BookingError, createWalkIn } from "@/lib/services/booking";
import { ERRORS, fail, ok, readJson, requireOwner } from "@/lib/api-helpers";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";

type Body = { name?: string; mobile?: string };

export async function POST(req: Request) {
  const auth = await requireOwner(req);
  if (auth instanceof Response) return auth;

  const rl = await checkAndIncrement(
    LIMITS.owner_mutation_per_user,
    "owner_mutation",
    String(auth.user.id),
  );
  if (!rl.ok) return fail(429, "Too many actions. Slow down.", "RATE_LIMITED");

  const body = await readJson<Body>(req);
  if (!body?.name || !body?.mobile) {
    return ERRORS.BAD_REQUEST("Name and mobile are required.");
  }

  try {
    const booking = await createWalkIn({
      clinic: auth.clinic,
      createdByUserId: auth.user.id,
      name: body.name,
      mobile: body.mobile,
    });
    // Fetch patient name for the mobile UI's queue-list refresh — the
    // insert-only createWalkIn doesn't join it back for us.
    const [patient] = await db
      .select({ name: schema.patients.name })
      .from(schema.patients)
      .where(
        and(
          eq(schema.patients.clinicId, auth.clinic.id),
          eq(schema.patients.id, booking.patientId),
        ),
      )
      .limit(1);
    return ok(
      {
        booking: {
          id: booking.id,
          token: booking.token,
          patientName: patient?.name ?? body.name,
          slotIso: booking.slotTime.toISOString(),
          status: booking.status,
        },
      },
      201,
    );
  } catch (err) {
    if (err instanceof BookingError) {
      // Slot-full, invalid mobile, name too long — all user-fixable.
      return fail(400, err.message, "WALKIN_REJECTED");
    }
    console.error("[owner/queue/walkin] crashed:", err);
    return ERRORS.SERVER();
  }
}
