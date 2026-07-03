// POST /api/v1/owner/queue/start — flip a booking from
// checked_in → in_consult. Reuses queue.startConsult() so the "only
// one consult active at a time" invariant fires uniformly with the
// web dashboard.

export const dynamic = "force-dynamic";

import { QueueActionError, startConsult } from "@/lib/services/queue";
import { ERRORS, ok, readJson, requireOwner } from "@/lib/api-helpers";

type Body = { bookingId?: number };

export async function POST(req: Request) {
  const auth = await requireOwner(req);
  if (auth instanceof Response) return auth;

  const body = await readJson<Body>(req);
  if (!body?.bookingId || !Number.isFinite(body.bookingId)) {
    return ERRORS.BAD_REQUEST("bookingId is required.");
  }

  try {
    await startConsult(auth.clinic.id, body.bookingId);
    return ok({ bookingId: body.bookingId, status: "in_consult" });
  } catch (err) {
    if (err instanceof QueueActionError) {
      return ERRORS.CONFLICT(err.message, "INVALID_STATE");
    }
    console.error("[owner/queue/start] crashed:", err);
    return ERRORS.SERVER();
  }
}
