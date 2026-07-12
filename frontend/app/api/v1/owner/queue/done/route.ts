// POST /api/v1/owner/queue/done — mark the current consult as done.
// Reuses queue.markDone() so the next-booking promotion side-effects
// match the web dashboard exactly.

export const dynamic = "force-dynamic";

import { markDone, QueueActionError } from "@/lib/services/queue";
import { ERRORS, fail, ok, readJson, requireOwner } from "@/lib/api-helpers";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";

type Body = { bookingId?: number; amountPaidInr?: number | null };

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
    // Service does its own clamp — we just forward, keeping the API
    // permissive (bad amount is dropped to null, mark-done still runs).
    await markDone(auth.clinic.id, body.bookingId, body.amountPaidInr ?? null);
    return ok({ bookingId: body.bookingId, status: "done" });
  } catch (err) {
    if (err instanceof QueueActionError) {
      return ERRORS.CONFLICT(err.message, "INVALID_STATE");
    }
    console.error("[owner/queue/done] crashed:", err);
    return ERRORS.SERVER();
  }
}
