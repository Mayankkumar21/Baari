"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  CheckCircle2,
  Coffee,
  Loader2,
  Moon,
  Play,
  Plus,
  RotateCcw,
  Stethoscope,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";
import { fmtTime } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  addSubTokenAction,
  cancelAction,
  cancelSubTokenAction,
  checkInAction,
  closeDayAction,
  markDoneAction,
  markSubDoneAction,
  rescheduleAction,
  restoreNoShowAction,
  startConsultAction,
  startSubTokenAction,
  undoDoneAction,
} from "@/app/(app)/queue/actions";

type SubTokenRow = {
  id: number;
  suffix: number;
  name: string;
  reason: string | null;
  status: string;
  label: string;
};

type Row = {
  bookingId: number;
  patientName: string;
  partySize: number;
  reason: string | null;
  label: string;
  token: number;
  slotTime: string;
  status: string;
  isLate: boolean;
  isUndoable: boolean;
  subTokens: SubTokenRow[];
};

type NowConsulting = {
  label: string;
  patientName: string;
  reason: string | null;
  bookingId: number;
  subTokenId: number | null;
  pendingSubs: { id: number; label: string; name: string }[];
};

type Summary = {
  totalBookings: number;
  completed: number;
  noShows: number;
  cancellations: number;
  avgWaitSeconds: number | null;
  avgConsultSeconds: number | null;
  peakHour: number | null;
  closedAt: string | null;
} | null;

type Vocab = {
  providerTitled: string;
  sessionTitled: string;
  sessionProgress: string;
  entitySingular: string;
};

export function QueueBoard({
  waiting,
  done,
  nowConsulting,
  counters,
  vocab,
  availableSlots,
  isClosed,
  summary,
  isDoctor,
}: {
  waiting: Row[];
  done: Row[];
  nowConsulting: NowConsulting | null;
  counters: { booked: number; waiting: number; done: number; noShow: number };
  vocab: Vocab;
  availableSlots: string[];
  isClosed: boolean;
  summary: Summary;
  isDoctor: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Day-closed banner */}
      {isClosed && summary ? <DayClosedBanner summary={summary} /> : null}

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
                <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                  {c.label}
                </div>
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
                    <QueueRow
                      row={row}
                      vocab={vocab}
                      availableSlots={availableSlots}
                      readOnly={isClosed}
                    />
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
                <NowCard nc={nowConsulting} vocab={vocab} readOnly={isClosed} />
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
                done
                  .slice(0, 6)
                  .map((row) => (
                    <QueueRow
                      key={row.bookingId}
                      row={row}
                      vocab={vocab}
                      availableSlots={availableSlots}
                      readOnly={isClosed}
                    />
                  ))
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

// ─────────────────────────────────────────────────────────────────────────────
// Close-day button
// ─────────────────────────────────────────────────────────────────────────────

export function CloseDayButton({ disabled }: { disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Button
      variant="outline"
      disabled={pending || disabled}
      onClick={() => {
        if (!confirm("Close the day? Active bookings get marked no-show; the board becomes read-only.")) {
          return;
        }
        setError(null);
        start(async () => {
          const r = await closeDayAction();
          if (!r.ok) setError(r.error);
        });
      }}
      title={error ?? undefined}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Moon className="size-4" />}{" "}
      Close day
    </Button>
  );
}

function DayClosedBanner({ summary }: { summary: NonNullable<Summary> }) {
  const avgWait =
    summary.avgWaitSeconds != null ? `${Math.round(summary.avgWaitSeconds / 60)}m` : "—";
  const avgConsult =
    summary.avgConsultSeconds != null ? `${Math.round(summary.avgConsultSeconds / 60)}m` : "—";
  const peakHour =
    summary.peakHour != null ? String(summary.peakHour).padStart(2, "0") + ":00" : "—";
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/8 p-5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.06em] text-primary">Day closed</div>
          <div className="mt-1 text-base font-semibold">Today is read-only.</div>
        </div>
        <Moon className="size-6 text-primary" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: summary.totalBookings },
          { label: "Completed", value: summary.completed },
          { label: "No-shows", value: summary.noShows },
          { label: "Cancelled", value: summary.cancellations },
          { label: "Avg wait", value: avgWait },
          { label: "Avg consult", value: avgConsult },
          { label: "Peak hour", value: peakHour },
        ].map((c) => (
          <div key={c.label}>
            <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
              {c.label}
            </div>
            <div className="font-semibold">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Now-consulting card
// ─────────────────────────────────────────────────────────────────────────────

function NowCard({
  nc,
  vocab,
  readOnly,
}: {
  nc: NowConsulting;
  vocab: Vocab;
  readOnly: boolean;
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
        {nc.reason ? (
          <div className="mt-0.5 text-sm text-muted-foreground">{nc.reason}</div>
        ) : null}
      </div>

      {/* Pending sub-tokens preview */}
      {nc.pendingSubs.length ? (
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            Next in family:
          </span>
          {nc.pendingSubs.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium"
            >
              {s.label} · {s.name}
            </span>
          ))}
        </div>
      ) : null}

      {!readOnly ? (
        <div className="relative mt-6 flex flex-wrap gap-2">
          <Button
            variant="glow"
            size="lg"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (nc.subTokenId != null) {
                  await markSubDoneAction(nc.subTokenId);
                } else {
                  await markDoneAction(nc.bookingId);
                }
              })
            }
          >
            <CheckCircle2 className="size-4" /> Mark done
          </Button>
          <AddFamilyPopover bookingId={nc.bookingId} compact />
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue row
// ─────────────────────────────────────────────────────────────────────────────

function QueueRow({
  row,
  vocab,
  availableSlots,
  readOnly,
}: {
  row: Row;
  vocab: Vocab;
  availableSlots: string[];
  readOnly: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const stateStyles =
    row.status === "checked_in"
      ? "border-emerald-400/40 bg-emerald-500/8"
      : row.status === "in_consult"
        ? "border-primary/40 bg-primary/8"
        : row.status === "no_show"
          ? "opacity-60"
          : row.status === "cancelled"
            ? "opacity-50"
            : "border-border";

  const isClosedRow =
    row.status === "done" || row.status === "no_show" || row.status === "cancelled";

  const runVoidAction = async (
    actionPromise: Promise<{ ok: boolean; error?: string }>,
  ) => {
    setError(null);
    const res = await actionPromise;
    if (!res.ok && res.error) setError(res.error);
  };

  return (
    <div
      style={{ viewTransitionName: `row-${row.bookingId}` }}
      className={cn(
        "group rounded-lg border bg-card/60 p-3 backdrop-blur transition-all hover:shadow-[0_2px_12px_-6px_hsl(var(--primary)/0.25)]",
        stateStyles,
        row.isLate ? "border-amber-400/40 bg-amber-500/8" : "",
      )}
    >
      <div className="grid grid-cols-[56px_1fr_auto] items-center gap-3">
        <div className="rounded-md bg-secondary px-2 py-1 text-center text-base font-bold">
          {row.label}
        </div>
        <div className="min-w-0">
          <div
            className={cn(
              "truncate font-semibold",
              row.status === "no_show" || row.status === "cancelled" ? "line-through" : "",
            )}
          >
            {row.patientName}
            {row.partySize > 1 ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · party of {row.partySize}
              </span>
            ) : null}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            <span>{fmtTime(row.slotTime)}</span>
            {row.reason ? (
              <>
                {" · "}
                <span>{row.reason}</span>
              </>
            ) : null}
            {row.isLate ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                Late
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!readOnly && row.status === "booked" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(() => runVoidAction(checkInAction(row.bookingId)))
                }
              >
                <UserCheck className="size-3.5" /> Check in
              </Button>
              <ReschedulePopover
                bookingId={row.bookingId}
                slotTime={row.slotTime}
                availableSlots={availableSlots}
              />
              <CancelButton bookingId={row.bookingId} />
              <AddFamilyPopover bookingId={row.bookingId} />
            </>
          ) : null}
          {!readOnly && row.status === "checked_in" ? (
            <>
              <Button
                size="sm"
                variant="default"
                disabled={pending}
                onClick={() =>
                  start(() => runVoidAction(startConsultAction(row.bookingId)))
                }
              >
                <Play className="size-3.5" /> Start
              </Button>
              <ReschedulePopover
                bookingId={row.bookingId}
                slotTime={row.slotTime}
                availableSlots={availableSlots}
              />
              <CancelButton bookingId={row.bookingId} />
              <AddFamilyPopover bookingId={row.bookingId} />
            </>
          ) : null}
          {!readOnly && row.status === "done" && row.isUndoable ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(() => runVoidAction(undoDoneAction(row.bookingId)))
              }
            >
              <RotateCcw className="size-3.5" /> Undo
            </Button>
          ) : null}
          {row.status === "done" && !row.isUndoable ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-3" /> Done
            </span>
          ) : null}
          {!readOnly && row.status === "no_show" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(() => runVoidAction(restoreNoShowAction(row.bookingId)))
              }
            >
              <RotateCcw className="size-3.5" /> Restore
            </Button>
          ) : null}
          {row.status === "cancelled" ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">Cancelled</span>
          ) : null}
        </div>
      </div>

      {/* Sub-tokens row */}
      {row.subTokens.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[68px]">
          {row.subTokens.map((s) => (
            <SubTokenChip
              key={s.id}
              sub={s}
              readOnly={readOnly || isClosedRow}
              parentInConsult={row.status === "in_consult"}
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-token chip
// ─────────────────────────────────────────────────────────────────────────────

function SubTokenChip({
  sub,
  readOnly,
  parentInConsult,
}: {
  sub: SubTokenRow;
  readOnly: boolean;
  parentInConsult: boolean;
}) {
  const [pending, start] = useTransition();

  const stateClass =
    sub.status === "done"
      ? "border-emerald-400/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
      : sub.status === "in_consult"
        ? "border-primary/40 bg-primary/15 text-foreground"
        : sub.status === "cancelled"
          ? "border-border bg-secondary/60 line-through opacity-60"
          : "border-border bg-secondary/60";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        stateClass,
      )}
    >
      {sub.status === "done" ? <CheckCircle2 className="size-3" /> : null}
      {sub.status === "in_consult" ? <Stethoscope className="size-3" /> : null}
      <span>
        {sub.label} · {sub.name}
      </span>
      {!readOnly && sub.status === "booked" && parentInConsult ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => void (await startSubTokenAction(sub.id)))}
          className="text-primary hover:underline"
          title="Start this sub-token's consult"
        >
          start
        </button>
      ) : null}
      {!readOnly && sub.status === "booked" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => void (await cancelSubTokenAction(sub.id)))}
          className="text-muted-foreground hover:text-destructive"
          title="Cancel this sub-token"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add-family popover
// ─────────────────────────────────────────────────────────────────────────────

function AddFamilyPopover({
  bookingId,
  compact,
}: {
  bookingId: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="relative">
      <Button
        size={compact ? "default" : "sm"}
        variant={compact ? "outline" : "ghost"}
        onClick={() => setOpen((v) => !v)}
        title="Add family member"
      >
        <UserPlus className="size-3.5" /> {compact ? "Add family" : ""}
      </Button>
      {open ? (
        <form
          action={(fd) => {
            setError(null);
            start(async () => {
              const r = await addSubTokenAction(bookingId, fd);
              if (r.ok) {
                setOpen(false);
              } else if (r.error) {
                setError(r.error);
              }
            });
          }}
          className="absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-border bg-card/95 p-3 shadow-xl backdrop-blur"
        >
          <div className="space-y-2">
            <div>
              <Label htmlFor="sub_name" className="mb-1 block">
                Family member name
              </Label>
              <Input id="sub_name" name="name" required maxLength={80} autoFocus />
            </div>
            <div>
              <Label htmlFor="sub_reason" className="mb-1 block">
                Reason (optional)
              </Label>
              <Input id="sub_reason" name="reason" maxLength={200} />
            </div>
            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                {error}
              </div>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" variant="glow" disabled={pending}>
                <Plus className="size-3.5" /> Add
              </Button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reschedule popover
// ─────────────────────────────────────────────────────────────────────────────

function ReschedulePopover({
  bookingId,
  slotTime,
  availableSlots,
}: {
  bookingId: number;
  slotTime: string;
  availableSlots: string[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const options = availableSlots.filter((iso) => iso !== slotTime);

  return (
    <div className="relative">
      <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} title="Reschedule">
        <Calendar className="size-3.5" />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-border bg-card/95 p-3 shadow-xl backdrop-blur">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Move to another slot today
          </div>
          {options.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
              No other slots open today.
            </div>
          ) : (
            <div className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto">
              {options.map((iso) => (
                <button
                  key={iso}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    start(async () => {
                      const r = await rescheduleAction(bookingId, iso);
                      if (r.ok) {
                        setOpen(false);
                      } else if (r.error) {
                        setError(r.error);
                      }
                    });
                  }}
                  className="rounded-md border border-border bg-card/60 px-2 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
                >
                  {fmtTime(iso)}
                </button>
              ))}
            </div>
          )}
          {error ? (
            <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
              {error}
            </div>
          ) : null}
          <div className="mt-2 flex justify-end">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancel button
// ─────────────────────────────────────────────────────────────────────────────

function CancelButton({ bookingId }: { bookingId: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      title={error ?? "Cancel booking"}
      onClick={() => {
        if (!confirm("Cancel this booking? Patient gets a WhatsApp notice if enabled.")) return;
        setError(null);
        start(async () => {
          const r = await cancelAction(bookingId);
          if (!r.ok && r.error) setError(r.error);
        });
      }}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
