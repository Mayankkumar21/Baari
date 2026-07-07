// POST /api/v1/owner/queue/no-show — mark a booking as no_show.
// Reuses queue.markNoShowManual() which also bumps patient.noShowCount
// and pulls the next checked_in booking into the in_consult slot if
// needed. Frontend should confirm before hitting this (destructive).

export const dynamic = "force-dynamic";

import { markNoShowManual, QueueActionError } from "@/lib/services/queue";
import { ERRORS, fail, ok, readJson, requireOwner } from "@/lib/api-helpers";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";

type Body = { bookingId?: number };

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
  if (!body?.bookingId || !Number.isFinite(body.bookingId)) {
    return ERRORS.BAD_REQUEST("bookingId is required.");
  }

  try {
    await markNoShowManual(auth.clinic.id, body.bookingId);
    return ok({ bookingId: body.bookingId, status: "no_show" });
  } catch (err) {
    if (err instanceof QueueActionError) {
      return ERRORS.CONFLICT(err.message, "INVALID_STATE");
    }
    console.error("[owner/queue/no-show] crashed:", err);
    return ERRORS.SERVER();
  }
}
