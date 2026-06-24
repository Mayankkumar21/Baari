import { requireSetup } from "@/lib/session";
import { vocabFor } from "@/lib/vocab";
import { buildBoard, type QueueRowVM, type SubTokenVM } from "@/lib/services/queue";
import { availableSlots, enumerateSlots, takenSlots } from "@/lib/services/booking";
import { servicesFor } from "@/lib/services/service-types";
import { clinicToday, fmtDateTime, fmtTime } from "@/lib/time";
import { QueueBoard } from "@/components/app/queue-board";
import { AutoRefresh } from "@/components/app/auto-refresh";
import type { SubToken } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function serializeRow(r: QueueRowVM, noShowThresholdMin: number, now: Date) {
  const slotMs = new Date(r.booking.slotTime).getTime();
  // "Running late" threshold = slot time + half the no-show threshold. So a
  // 30-min no-show clinic flags a row as late 15 min past its slot.
  const lateThresholdMs = slotMs + (noShowThresholdMin * 60 * 1000) / 2;
  const minutesLate =
    (r.booking.status === "booked" || r.booking.status === "checked_in") &&
    now.getTime() >= lateThresholdMs
      ? Math.floor((now.getTime() - slotMs) / 60000)
      : 0;
  return {
    bookingId: r.booking.id,
    patientName: r.patient.name,
    partySize: r.booking.partySize,
    reason: r.booking.reason,
    label: r.label,
    token: r.booking.token,
    slotTime: r.booking.slotTime.toISOString(),
    status: r.booking.status,
    isLate: minutesLate > 0,
    minutesLate,
    isUndoable: r.isUndoable,
    completedAt: r.booking.completedAt?.toISOString() ?? null,
    subTokens: r.subTokens.map((s) => serializeSub(s, r.booking.token)),
  };
}

function serializeSub(s: SubToken, token: number) {
  return {
    id: s.id,
    suffix: s.suffix,
    name: s.name,
    reason: s.reason,
    status: s.status,
    label: `T${token}.${s.suffix}`,
  };
}

export default async function QueuePage() {
  const sess = await requireSetup();
  const vocab = vocabFor(sess.clinic.tenantType);
  const board = await buildBoard(sess.clinic.id);

  const today = clinicToday();
  const taken = await takenSlots(sess.clinic.id, today);
  const slots = availableSlots(sess.clinic, today, taken);
  const allSlots = enumerateSlots(sess.clinic, today, taken);
  const slotsFree = allSlots.filter((s) => s.status === "open").length;
  const services = servicesFor(sess.clinic.tenantType);
  const nextFreeSlot = slots[0] ?? null;

  const isDoctor = sess.user.role === "doctor";
  const now = board.generatedAt;

  const waitingRows = board.waiting.map((r) =>
    serializeRow(r, sess.clinic.noShowThresholdMin, now),
  );
  const doneRows = board.done.map((r) => serializeRow(r, sess.clinic.noShowThresholdMin, now));

  // Summary line counts. "Today" = non-cancelled bookings made today.
  const summary = {
    today: board.counters.booked,
    waiting: board.counters.waiting,
    inSession: board.nowConsulting ? 1 : 0,
    runningLate: waitingRows.filter((r) => r.isLate).length,
    nextFree: nextFreeSlot ? fmtTime(nextFreeSlot) : "—",
  };

  const summaryRender = board.summary
    ? {
        totalBookings: board.summary.totalBookings,
        completed: board.summary.completed,
        noShows: board.summary.noShows,
        cancellations: board.summary.cancellations,
        avgWaitSeconds: board.summary.avgWaitSeconds,
        avgConsultSeconds: board.summary.avgConsultSeconds,
        peakHour: board.summary.peakHour,
        closedAt: board.summary.closedAt?.toISOString() ?? null,
      }
    : null;

  return (
    <>
      <AutoRefresh intervalMs={15_000} />
      <QueueBoard
        generatedAtLabel={fmtDateTime(board.generatedAt)}
      counters={board.counters}
      summary={summary}
      nowConsulting={
        board.nowConsulting
          ? {
              label: board.nowConsulting.label,
              patientName: board.nowConsulting.patientName,
              reason: board.nowConsulting.reason,
              bookingId: board.nowConsulting.booking.id,
              subTokenId: board.nowConsulting.subToken?.id ?? null,
              startedAt: board.nowConsulting.subToken?.startedAt?.toISOString()
                ?? board.nowConsulting.booking.startedAt?.toISOString()
                ?? null,
              pendingSubs: board.nowConsulting.pendingSubs.map((p: SubTokenVM) => ({
                id: p.subToken.id,
                label: p.label,
                name: p.subToken.name,
              })),
            }
          : null
      }
      waiting={waitingRows}
      done={doneRows}
      vocab={vocab}
      availableSlots={slots}
      bookingInputs={{
        slots: allSlots,
        freeCount: slotsFree,
        totalCount: allSlots.length,
        services,
        reasonLabel: vocab.reasonLabel,
        entitySingular: vocab.entitySingular,
      }}
        isClosed={board.isClosed}
        summaryBanner={summaryRender}
        isDoctor={isDoctor}
      />
    </>
  );
}
