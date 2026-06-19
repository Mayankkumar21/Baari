import Link from "next/link";
import { Plus } from "lucide-react";
import { requireSetup } from "@/lib/session";
import { vocabFor } from "@/lib/vocab";
import { buildBoard, type QueueRowVM, type SubTokenVM } from "@/lib/services/queue";
import { availableSlots, takenSlots } from "@/lib/services/booking";
import { clinicToday, fmtDateTime } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { CloseDayButton, QueueBoard } from "@/components/app/queue-board";
import type { SubToken } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function serializeRow(r: QueueRowVM) {
  return {
    bookingId: r.booking.id,
    patientName: r.patient.name,
    partySize: r.booking.partySize,
    reason: r.booking.reason,
    label: r.label,
    token: r.booking.token,
    slotTime: r.booking.slotTime.toISOString(),
    status: r.booking.status,
    isLate: r.isLate,
    isUndoable: r.isUndoable,
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

  // Slots for reschedule popover — today only.
  const today = clinicToday();
  const taken = await takenSlots(sess.clinic.id, today);
  const slots = availableSlots(sess.clinic, today, taken);

  const isDoctor = sess.user.role === "doctor";

  const summary = board.summary
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
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">
            {fmtDateTime(board.generatedAt)} · IST
            {board.isClosed ? <span className="ml-2 text-primary">· closed</span> : null}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Queue</h1>
        </div>
        <div className="flex items-center gap-2">
          {!board.isClosed && isDoctor ? <CloseDayButton /> : null}
          {!board.isClosed ? (
            <Button variant="glow" asChild>
              <Link href="/book">
                <Plus className="size-4" /> New booking
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <QueueBoard
        counters={board.counters}
        nowConsulting={
          board.nowConsulting
            ? {
                label: board.nowConsulting.label,
                patientName: board.nowConsulting.patientName,
                reason: board.nowConsulting.reason,
                bookingId: board.nowConsulting.booking.id,
                subTokenId: board.nowConsulting.subToken?.id ?? null,
                pendingSubs: board.nowConsulting.pendingSubs.map((p: SubTokenVM) => ({
                  id: p.subToken.id,
                  label: p.label,
                  name: p.subToken.name,
                })),
              }
            : null
        }
        waiting={board.waiting.map(serializeRow)}
        done={board.done.map(serializeRow)}
        vocab={vocab}
        availableSlots={slots}
        isClosed={board.isClosed}
        summary={summary}
        isDoctor={isDoctor}
      />
    </div>
  );
}
