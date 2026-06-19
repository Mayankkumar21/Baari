"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  Coffee,
  Play,
  RotateCcw,
  Stethoscope,
  UserCheck,
  UserX,
} from "lucide-react";
import { useTransition } from "react";
import { fmtTime } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  checkInAction,
  markDoneAction,
  restoreNoShowAction,
  startConsultAction,
  undoDoneAction,
} from "@/app/(app)/queue/actions";

// Serializable shape coming from server component — Drizzle Dates become strings.
type Row = {
  bookingId: number;
  patientName: string;
  partySize: number;
  reason: string | null;
  label: string;
  slotTime: string;
  status: string;
  isLate: boolean;
  isUndoable: boolean;
  pendingSubCount: number;
};

type NowConsulting = {
  label: string;
  patientName: string;
  reason: string | null;
  bookingId: number;
  isSubToken: boolean;
};

export function QueueBoard({
  waiting,
  done,
  nowConsulting,
  counters,
  vocab,
}: {
  waiting: Row[];
  done: Row[];
  nowConsulting: NowConsulting | null;
  counters: { booked: number; waiting: number; done: number; noShow: number };
  vocab: { providerTitled: string; sessionTitled: string; sessionProgress: string; entitySingular: string };
}) {
  return (
    <div className="space-y-5">
      {/* Counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { key: "booked", label: "Booked", value: counters.booked },
          { key: "waiting", label: "Waiting", value: counters.waiting },
          { key: "done", label: "Done", value: counters.done },
          { key: "no_show", label: "No-show", value: counters.noShow },
        ].map((c) => (
          <motion.div
            key={c.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <CardContent className="p-4">
                <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">{c.label}</div>
                <div className="mt-1 text-2xl font-bold">{c.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Waiting list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-5 pb-3">
            <CardTitle>Waiting</CardTitle>
            <div className="text-xs text-muted-foreground">{waiting.length}</div>
          </CardHeader>
          <CardContent className="space-y-1.5 p-5 pt-0">
            <AnimatePresence initial={false}>
              {waiting.length ? (
                waiting.map((row) => (
                  <motion.div
                    key={row.bookingId}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <QueueRow row={row} vocab={vocab} />
                  </motion.div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-border py-9 text-center text-sm text-muted-foreground">
                  <Coffee className="mx-auto mb-2 size-5" />
                  Quiet for now.
                </div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Now consulting + Done */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-5 pb-3">
              <CardTitle>Now {vocab.sessionProgress}</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {nowConsulting ? (
                <NowCard nc={nowConsulting} vocab={vocab} />
              ) : (
                <div className="rounded-md border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  <UserX className="mx-auto mb-2 size-5" />
                  No active {vocab.sessionTitled.toLowerCase()}.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between p-5 pb-3">
              <CardTitle>Done today</CardTitle>
              <div className="text-xs text-muted-foreground">{done.length}</div>
            </CardHeader>
            <CardContent className="space-y-1.5 p-5 pt-0">
              {done.length ? (
                done.slice(0, 6).map((row) => <QueueRow key={row.bookingId} row={row} vocab={vocab} />)
              ) : (
                <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                  No completed {vocab.sessionTitled.toLowerCase()}s yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function NowCard({
  nc,
  vocab,
}: {
  nc: NowConsulting;
  vocab: { providerTitled: string; sessionTitled: string; sessionProgress: string };
}) {
  const [pending, start] = useTransition();
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-card/70 p-6 backdrop-blur-md shadow-[0_0_0_1px_hsl(var(--primary)/0.18),0_24px_64px_-32px_hsl(var(--primary)/0.4)]">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Token</div>
          <div className="bg-gradient-to-b from-foreground from-30% to-primary bg-clip-text text-5xl font-bold tracking-tight text-transparent">
            {nc.label}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          <Stethoscope className="size-3" /> {vocab.sessionProgress}
        </span>
      </div>
      <div className="relative mt-4">
        <div className="text-xl font-semibold">{nc.patientName}</div>
        {nc.reason ? <div className="mt-0.5 text-sm text-muted-foreground">{nc.reason}</div> : null}
      </div>
      {!nc.isSubToken ? (
        <div className="relative mt-6 flex gap-2">
          <Button
            variant="glow"
            size="lg"
            disabled={pending}
            onClick={() => start(async () => void (await markDoneAction(nc.bookingId)))}
          >
            <CheckCircle2 className="size-4" /> Mark done
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function QueueRow({
  row,
  vocab,
}: {
  row: Row;
  vocab: { sessionTitled: string };
}) {
  const [pending, start] = useTransition();

  const stateStyles =
    row.status === "checked_in"
      ? "border-emerald-400/40 bg-emerald-500/8"
      : row.status === "in_consult"
        ? "border-primary/40 bg-primary/8"
        : row.status === "no_show"
          ? "opacity-60 line-through"
          : row.status === "cancelled"
            ? "opacity-50 line-through"
            : "border-border";

  return (
    <div
      style={{ viewTransitionName: `row-${row.bookingId}` }}
      className={cn(
        "group grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-lg border bg-card/60 p-3 backdrop-blur transition-all hover:translate-x-0.5 hover:shadow-[0_2px_12px_-6px_hsl(var(--primary)/0.25)]",
        stateStyles,
        row.isLate ? "border-amber-400/40 bg-amber-500/8" : "",
      )}
    >
      <div className="rounded-md bg-secondary px-2 py-1 text-center text-base font-bold">{row.label}</div>
      <div className="min-w-0">
        <div className="truncate font-semibold">
          {row.patientName}
          {row.partySize > 1 ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">· party of {row.partySize}</span>
          ) : null}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          <span>{fmtTime(row.slotTime)}</span>
          {row.reason ? <> · <span>{row.reason}</span></> : null}
          {row.isLate ? (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
              Late
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {row.status === "booked" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => start(async () => void (await checkInAction(row.bookingId)))}
          >
            <UserCheck className="size-3.5" /> Check in
          </Button>
        ) : null}
        {row.status === "checked_in" ? (
          <Button
            size="sm"
            variant="default"
            disabled={pending}
            onClick={() => start(async () => void (await startConsultAction(row.bookingId)))}
          >
            <Play className="size-3.5" /> Start
          </Button>
        ) : null}
        {row.status === "done" && row.isUndoable ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => start(async () => void (await undoDoneAction(row.bookingId)))}
          >
            <RotateCcw className="size-3.5" /> Undo
          </Button>
        ) : null}
        {row.status === "done" && !row.isUndoable ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3" /> Done
          </span>
        ) : null}
        {row.status === "no_show" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => start(async () => void (await restoreNoShowAction(row.bookingId)))}
          >
            <RotateCcw className="size-3.5" /> Restore
          </Button>
        ) : null}
        {row.status === "cancelled" ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">Cancelled</span>
        ) : null}
      </div>
    </div>
  );
}
