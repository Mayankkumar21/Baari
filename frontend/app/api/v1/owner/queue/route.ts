// GET /api/v1/owner/queue — today's queue for the authenticated owner.
//
// Reads the queue board (same one the web dashboard renders) and
// reshapes it into a mobile-friendly payload. Read-only in first draft —
// no actions (check-in / start / done) yet; those come in follow-up
// endpoints once the shell is proven.

export const dynamic = "force-dynamic";

import { buildBoard } from "@/lib/services/queue";
import { fail, ok, requireOwner } from "@/lib/api-helpers";
import { checkAndIncrement, LIMITS } from "@/lib/rate-limit";

// Booking status the mobile app understands. Same string the dashboard
// stores in the DB — kept as a plain string over the wire so the client
// can widen its type any time without a migration.
type OwnerQueueRow = {
  bookingId: number;
  token: number;
  label: string; // "T5"
  patientName: string;
  partySize: number;
  reason: string | null;
  status: string;
  slotIso: string;
  isLate: boolean;
  // Minutes past slot when isLate. 0 otherwise.
  minutesLate: number;
  // Loyalty snapshot — count of prior completed visits (before today)
  // for this patient at this clinic, plus the last visit's ISO date
  // (YYYY-MM-DD). Both optional so older mobile clients tolerate the
  // absence without a crash — the row just doesn't render the chip.
  pastVisits?: number;
  lastVisitDate?: string | null;
};

type OwnerQueuePayload = {
  clinicName: string;
  generatedAtIso: string;
  isClosed: boolean;
  counters: {
    total: number;
    waiting: number;
    inSession: number;
    done: number;
    runningLate: number;
  };
  nowConsulting: {
    bookingId: number;
    label: string;
    patientName: string;
    reason: string | null;
    startedAtIso: string | null;
  } | null;
  waiting: OwnerQueueRow[];
  done: OwnerQueueRow[];
};

export async function GET(req: Request) {
  const auth = await requireOwner(req);
  if (auth instanceof Response) return auth;

  // Poll cap per user — mobile refetches every 30s and browser tab
  // polls at similar cadence. 240/hr = one poll every 15s continuously
  // for an hour, well above legitimate use but stops a runaway loop
  // (misbehaving custom client, stuck retry, script) from burning
  // compute.
  const pollCheck = await checkAndIncrement(
    LIMITS.poll_per_user,
    "queue_poll",
    String(auth.user.id),
  );
  if (!pollCheck.ok) {
    return fail(429, "Too many queue refreshes. Slow down.", "RATE_LIMITED");
  }

  const { user: _user, clinic } = auth;
  const board = await buildBoard(clinic.id);
  const now = board.generatedAt;
  const noShowThresholdMin = clinic.noShowThresholdMin;

  const serialize = (r: typeof board.waiting[number]): OwnerQueueRow => {
    const slotMs = new Date(r.booking.slotTime).getTime();
    // Same lateness heuristic as the web dashboard — half the no-show
    // threshold. Keeps the two surfaces consistent.
    const lateThresholdMs = slotMs + (noShowThresholdMin * 60 * 1000) / 2;
    const minutesLate =
      (r.booking.status === "booked" || r.booking.status === "checked_in") &&
      now.getTime() >= lateThresholdMs
        ? Math.floor((now.getTime() - slotMs) / 60000)
        : 0;
    return {
      bookingId: r.booking.id,
      token: r.booking.token,
      label: r.label,
      patientName: r.patient.name,
      partySize: r.booking.partySize,
      reason: r.booking.reason,
      status: r.booking.status,
      slotIso: new Date(r.booking.slotTime).toISOString(),
      isLate: minutesLate > 0,
      minutesLate,
      pastVisits: r.pastVisits,
      lastVisitDate: r.lastVisitDate,
    };
  };

  const waiting = board.waiting.map(serialize);
  const done = board.done.map(serialize);
  const runningLate = waiting.filter((r) => r.isLate).length;

  const payload: OwnerQueuePayload = {
    clinicName: clinic.name,
    generatedAtIso: board.generatedAt.toISOString(),
    isClosed: board.isClosed,
    counters: {
      total: board.counters.booked,
      waiting: board.counters.waiting,
      inSession: board.nowConsulting ? 1 : 0,
      done: board.counters.done,
      runningLate,
    },
    nowConsulting: board.nowConsulting
      ? {
          bookingId: board.nowConsulting.booking.id,
          label: board.nowConsulting.label,
          patientName: board.nowConsulting.patientName,
          reason: board.nowConsulting.reason,
          startedAtIso: board.nowConsulting.booking.startedAt
            ? new Date(board.nowConsulting.booking.startedAt).toISOString()
            : null,
        }
      : null,
    waiting,
    done,
  };

  return ok(payload);
}
