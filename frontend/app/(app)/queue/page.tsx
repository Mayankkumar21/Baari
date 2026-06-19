import Link from "next/link";
import { Plus } from "lucide-react";
import { requireSetup } from "@/lib/session";
import { vocabFor } from "@/lib/vocab";
import { buildBoard } from "@/lib/services/queue";
import { fmtDateTime } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { QueueBoard } from "@/components/app/queue-board";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const sess = await requireSetup();
  const vocab = vocabFor(sess.clinic.tenantType);
  const board = await buildBoard(sess.clinic.id);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{fmtDateTime(board.generatedAt)} · IST</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Queue</h1>
        </div>
        <Button variant="glow" asChild>
          <Link href="/book">
            <Plus className="size-4" /> New booking
          </Link>
        </Button>
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
                isSubToken: board.nowConsulting.subToken != null,
              }
            : null
        }
        waiting={board.waiting.map((r) => ({
          bookingId: r.booking.id,
          patientName: r.patient.name,
          partySize: r.booking.partySize,
          reason: r.booking.reason,
          label: r.label,
          slotTime: r.booking.slotTime.toISOString(),
          status: r.booking.status,
          isLate: r.isLate,
          isUndoable: r.isUndoable,
          pendingSubCount: r.pendingSubCount,
        }))}
        done={board.done.map((r) => ({
          bookingId: r.booking.id,
          patientName: r.patient.name,
          partySize: r.booking.partySize,
          reason: r.booking.reason,
          label: r.label,
          slotTime: r.booking.slotTime.toISOString(),
          status: r.booking.status,
          isLate: r.isLate,
          isUndoable: r.isUndoable,
          pendingSubCount: r.pendingSubCount,
        }))}
        vocab={vocab}
      />
    </div>
  );
}
