// POST /api/v1/owner/queue/done — mark the current consult as done.
// Reuses queue.markDone() so the family-group promotion (sub-token
// first, then next checked-in booking) side-effects match the web
// dashboard exactly.

export const dynamic = "force-dynamic";

import { markDone, QueueActionError } from "@/lib/services/queue";
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
    await markDone(auth.clinic.id, body.bookingId);
    return ok({ bookingId: body.bookingId, status: "done" });
  } catch (err) {
    if (err instanceof QueueActionError) {
      return ERRORS.CONFLICT(err.message, "INVALID_STATE");
    }
    console.error("[owner/queue/done] crashed:", err);
    return ERRORS.SERVER();
  }
}
