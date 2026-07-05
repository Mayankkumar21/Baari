"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Coffee,
  History,
  Loader2,
  MessageSquare,
  MoreVertical,
  Moon,
  Play,
  Plus,
  RotateCcw,
  Stethoscope,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { fmtTime } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BookForm, type SlotInfo } from "@/app/(app)/book/book-form";
import {
  addSubTokenAction,
  cancelAction,
  cancelSubTokenAction,
  checkInAction,
  closeDayAction,
  markDoneAction,
  markNoShowAction,
  markSubDoneAction,
  reopenAction,
  rescheduleAction,
  restoreNoShowAction,
  sendReminderAction,
  startConsultAction,
  startSubTokenAction,
  undoDoneAction,
  walkInAction,
} from "@/app/(app)/queue/actions";

// ─── types ────────────────────────────────────────────────────────────────

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
  minutesLate: number;
  isUndoable: boolean;
  completedAt: string | null;
  subTokens: SubTokenRow[];
};

type NowConsulting = {
  label: string;
  patientName: string;
  reason: string | null;
  bookingId: number;
  subTokenId: number | null;
  startedAt: string | null;
  pendingSubs: { id: number; label: string; name: string }[];
};

type Summary = {
  today: number;
  waiting: number;
  inSession: number;
  runningLate: number;
  nextFree: string;
};

type DayClosedSummary = {
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

type BookingInputs = {
  slots: SlotInfo[];
  freeCount: number;
  totalCount: number;
  services: string[];
  reasonLabel: string;
  entitySingular: string;
};

// ─── main ────────────────────────────────────────────────────────────────

export function QueueBoard({
  generatedAtLabel,
  waiting,
  done,
  nowConsulting,
  counters,
  summary,
  vocab,
  availableSlots,
  bookingInputs,
  isClosed,
  summaryBanner,
  isDoctor,
}: {
  generatedAtLabel: string;
  waiting: Row[];
  done: Row[];
  nowConsulting: NowConsulting | null;
  counters: { booked: number; waiting: number; done: number; noShow: number };
  summary: Summary;
  vocab: Vocab;
  availableSlots: string[];
  bookingInputs: BookingInputs;
  isClosed: boolean;
  summaryBanner: DayClosedSummary;
  isDoctor: boolean;
}) {
  const [bookOpen, setBookOpen] = useState(false);
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">
            {generatedAtLabel} · IST
            {isClosed ? <span className="ml-2 text-primary">· closed</span> : null}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Queue</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isClosed && isDoctor ? (
            <div data-tour-id="close-day">
              <CloseDayButton />
            </div>
          ) : null}
          {!isClosed ? <WalkInButton /> : null}
          {!isClosed ? (
            <Button
              data-tour-id="new-booking"
              variant="glow"
              onClick={() => setBookOpen(true)}
            >
              <Plus className="size-4" /> New booking
            </Button>
          ) : null}
        </div>
      </div>

      {/* Day-closed banner (read-only summary) */}
      {isClosed && summaryBanner ? <DayClosedBanner summary={summaryBanner} /> : null}

      {/* Summary strip */}
      {!isClosed ? (
        <div data-tour-id="counters">
          <SummaryStrip s={summary} vocab={vocab} />
        </div>
      ) : null}

      {/* Two-column layout */}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
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
                    <WaitingRow
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
      </div>

      {/* Done today — thin collapsible strip at the bottom */}
      <DoneStrip rows={done} vocab={vocab} readOnly={isClosed} />

      {/* Slide-in booking panel over the queue */}
      <BookPanel
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        inputs={bookingInputs}
      />
    </div>
  );
}

function BookPanel({
  open,
  onClose,
  inputs,
}: {
  open: boolean;
  onClose: () => void;
  inputs: BookingInputs;
}) {
  // Close on Escape and when clicking the backdrop.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "h-full w-full max-w-md overflow-y-auto border-l border-border bg-card shadow-2xl",
          "translate-x-0 transition-transform duration-200 ease-out",
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 p-4 backdrop-blur">
          <div>
            <div className="text-sm font-semibold">New booking</div>
            <div className="text-[11px] text-muted-foreground">
              {inputs.freeCount} of {inputs.totalCount} slots free today
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} title="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="p-4 sm:p-5">
          <BookForm
            slots={inputs.slots}
            freeCount={inputs.freeCount}
            totalCount={inputs.totalCount}
            services={inputs.services}
            reasonLabel={inputs.reasonLabel}
            entitySingular={inputs.entitySingular}
            fromPanel
            onSuccess={onClose}
          />
        </div>
      </aside>
    </div>
  );
}

// ─── summary strip ────────────────────────────────────────────────────────

function SummaryStrip({ s, vocab }: { s: Summary; vocab: Vocab }) {
  const items = [
    { label: "Today", value: s.today },
    { label: "Waiting", value: s.waiting },
    { label: `In ${vocab.sessionProgress.split(" ")[1] ?? "session"}`, value: s.inSession },
    {
      label: "Running late",
      value: s.runningLate,
      tone: s.runningLate > 0 ? "amber" : undefined,
    },
    { label: "Next free", value: s.nextFree },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-card/60 px-4 py-2.5 text-xs backdrop-blur">
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center gap-2">
          <span className="text-muted-foreground">{it.label}:</span>
          <span
            className={cn(
              "font-semibold tabular-nums",
              it.tone === "amber" ? "text-amber-500" : "text-foreground",
            )}
          >
            {it.value}
          </span>
          {i < items.length - 1 ? <span className="text-muted-foreground/40">·</span> : null}
        </div>
      ))}
    </div>
  );
}

// ─── close day button + closed banner ─────────────────────────────────────

function CloseDayButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "Close the day? Active bookings get marked no-show; the board becomes read-only.",
          )
        )
          return;
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

function DayClosedBanner({ summary }: { summary: NonNullable<DayClosedSummary> }) {
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

// ─── walk-in button + popover ─────────────────────────────────────────────

function WalkInButton() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen((v) => !v)}>
        <UserPlus className="size-4" /> Walk in
      </Button>
      {open ? (
        <form
          action={(fd) => {
            setError(null);
            start(async () => {
              const r = await walkInAction(fd);
              if (r.ok) {
                setOpen(false);
              } else {
                setError(r.error);
              }
            });
          }}
          className="absolute right-0 top-full z-30 mt-2 w-80 rounded-lg border border-border bg-card/95 p-4 shadow-xl backdrop-blur"
        >
          <div className="mb-3 text-sm font-semibold">Walk-in</div>
          <p className="mb-3 text-xs text-muted-foreground">
            We'll take the next open slot today.
          </p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="walkin_name" className="mb-1 block">
                Name
              </Label>
              <Input id="walkin_name" name="name" required maxLength={80} autoFocus />
            </div>
            <div>
              <Label htmlFor="walkin_mobile" className="mb-1 block">
                Mobile
              </Label>
              <Input
                id="walkin_mobile"
                name="mobile"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                required
                placeholder="10 digits"
              />
            </div>
            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                {error}
              </div>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" variant="glow" disabled={pending}>
                <UserCheck className="size-3.5" /> Add walk-in
              </Button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}

// ─── now card ─────────────────────────────────────────────────────────────

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
  const startedAtLabel = nc.startedAt ? fmtTime(nc.startedAt) : null;
  const elapsedMin = nc.startedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(nc.startedAt).getTime()) / 60000))
    : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-400/30 bg-card/70 p-6 backdrop-blur-md shadow-[0_0_0_1px_rgb(16_185_129_/_0.18),0_24px_64px_-32px_rgb(16_185_129_/_0.4)]">
      {/* "In session" = active, green tint per the unified status colour
          system. Token text keeps the indigo→foreground gradient so the brand
          identity still shows. */}
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            Token
          </div>
          <div className="bg-gradient-to-b from-foreground from-30% to-primary bg-clip-text text-5xl font-bold tracking-tight text-transparent">
            {nc.label}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            <Stethoscope className="size-3" /> {vocab.sessionProgress}
          </span>
          {!readOnly ? <NowOverflowMenu bookingId={nc.bookingId} /> : null}
        </div>
      </div>
      <div className="relative mt-4">
        <div className="text-xl font-semibold">{nc.patientName}</div>
        {nc.reason ? (
          <div className="mt-0.5 text-sm text-muted-foreground">{nc.reason}</div>
        ) : null}
        {startedAtLabel ? (
          <div className="mt-1 text-xs text-muted-foreground">
            Started {startedAtLabel} · {elapsedMin ?? 0} min in
          </div>
        ) : null}
      </div>

      {nc.pendingSubs.length ? (
        <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
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
            variant="success"
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

function NowOverflowMenu({ bookingId }: { bookingId: number }) {
  return (
    <Menu
      label={<MoreVertical className="size-3.5" />}
      labelTitle="More actions"
      items={[
        {
          key: "cancel",
          icon: <Trash2 className="size-3.5" />,
          label: "Cancel session",
          confirm: "Cancel this active session? A WhatsApp will be sent if enabled.",
          run: () => cancelAction(bookingId),
        },
        {
          key: "noshow",
          icon: <UserX className="size-3.5" />,
          label: "Mark no-show",
          confirm: "Mark the active session as no-show?",
          run: () => markNoShowAction(bookingId),
        },
      ]}
    />
  );
}

// ─── waiting row ──────────────────────────────────────────────────────────

function WaitingRow({
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

  // Status colour system, unified across the app:
  //   waiting (booked/checked_in) → primary tint, the brand colour
  //   late                       → amber border + chip (highest priority)
  //   in_session                 → emerald (on the NOW card, not here)
  //   done                       → emerald dimmed
  //   no_show                    → red dimmed
  //   cancelled                  → grey, strikethrough
  const stateStyles = row.isLate
    ? "border-amber-400/50 bg-amber-500/8"
    : row.status === "checked_in"
      ? "border-primary/40 bg-primary/8"
      : "border-primary/15";

  return (
    <div
      style={{ viewTransitionName: `row-${row.bookingId}` }}
      className={cn(
        "group rounded-lg border bg-card/60 p-3 backdrop-blur transition-all hover:shadow-[0_2px_12px_-6px_hsl(var(--primary)/0.25)]",
        stateStyles,
      )}
    >
      <div className="grid grid-cols-[56px_1fr_auto] items-center gap-3">
        <div className="rounded-md bg-secondary px-2 py-1 text-center text-base font-bold">
          {row.label}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold">{row.patientName}</span>
            {row.partySize > 1 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Users className="size-2.5" /> +{row.partySize - 1} family
              </span>
            ) : null}
            {row.isLate ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                <AlertTriangle className="size-2.5" /> Late · {row.minutesLate} min
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
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!readOnly && row.status === "booked" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await checkInAction(row.bookingId);
                  if (!r.ok && r.error) setError(r.error);
                })
              }
            >
              <UserCheck className="size-3.5" /> Check in
            </Button>
          ) : null}
          {!readOnly && row.status === "checked_in" ? (
            <Button
              size="sm"
              variant="default"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await startConsultAction(row.bookingId);
                  if (!r.ok && r.error) setError(r.error);
                })
              }
            >
              <Play className="size-3.5" /> Start
            </Button>
          ) : null}
          {!readOnly ? (
            <WaitingOverflowMenu
              bookingId={row.bookingId}
              slotTime={row.slotTime}
              availableSlots={availableSlots}
            />
          ) : null}
        </div>
      </div>

      {row.subTokens.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[68px]">
          {row.subTokens.map((s) => (
            <SubTokenChip
              key={s.id}
              sub={s}
              readOnly={readOnly}
              parentInConsult={false}
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

function WaitingOverflowMenu({
  bookingId,
  slotTime,
  availableSlots,
}: {
  bookingId: number;
  slotTime: string;
  availableSlots: string[];
}) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  return (
    <>
      <Menu
        label={<MoreVertical className="size-3.5" />}
        labelTitle="More actions"
        items={[
          {
            key: "edit",
            icon: <Calendar className="size-3.5" />,
            label: "Reschedule",
            run: async () => {
              setRescheduleOpen(true);
              return { ok: true } as const;
            },
          },
          {
            key: "reminder",
            icon: <MessageSquare className="size-3.5" />,
            label: "Send WhatsApp reminder",
            run: () => sendReminderAction(bookingId),
          },
          {
            key: "noshow",
            icon: <UserX className="size-3.5" />,
            label: "Mark no-show",
            confirm: "Mark this booking as no-show?",
            run: () => markNoShowAction(bookingId),
          },
          {
            key: "cancel",
            icon: <Trash2 className="size-3.5" />,
            label: "Cancel booking",
            confirm: "Cancel this booking? Patient gets a WhatsApp notice if enabled.",
            run: () => cancelAction(bookingId),
          },
        ]}
      />
      {rescheduleOpen ? (
        <ReschedulePopover
          bookingId={bookingId}
          slotTime={slotTime}
          availableSlots={availableSlots}
          onClose={() => setRescheduleOpen(false)}
        />
      ) : null}
    </>
  );
}

// ─── sub-token chip ──────────────────────────────────────────────────────

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

// ─── add-family popover (unchanged) ──────────────────────────────────────

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
              if (r.ok) setOpen(false);
              else if (r.error) setError(r.error);
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

// ─── reschedule popover (standalone, controlled by parent) ────────────────

function ReschedulePopover({
  bookingId,
  slotTime,
  availableSlots,
  onClose,
}: {
  bookingId: number;
  slotTime: string;
  availableSlots: string[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const options = availableSlots.filter((iso) => iso !== slotTime);
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">Reschedule to another slot</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        {options.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No other slots open today.
          </div>
        ) : (
          <div className="grid max-h-72 grid-cols-3 gap-1.5 overflow-y-auto">
            {options.map((iso) => (
              <button
                key={iso}
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  start(async () => {
                    const r = await rescheduleAction(bookingId, iso);
                    if (r.ok) onClose();
                    else if (r.error) setError(r.error);
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
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── done strip (collapsible) ────────────────────────────────────────────

function DoneStrip({
  rows,
  vocab,
  readOnly,
}: {
  rows: Row[];
  vocab: Vocab;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card/60 backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
      >
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <span className="font-medium">Done today</span>
          <span className="text-xs text-muted-foreground">({rows.length})</span>
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open ? "rotate-180" : "",
          )}
        />
      </button>
      {open ? (
        <div className="space-y-1.5 border-t border-border p-3">
          {rows.map((r) => (
            <DoneRow key={r.bookingId} row={r} vocab={vocab} readOnly={readOnly} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DoneRow({
  row,
  vocab,
  readOnly,
}: {
  row: Row;
  vocab: Vocab;
  readOnly: boolean;
}) {
  // Unified status colour system for the done strip.
  const stateClass =
    row.status === "no_show"
      ? "border-rose-400/30 bg-rose-500/8 opacity-70"
      : row.status === "cancelled"
        ? "border-border bg-card/30 opacity-60"
        : "border-emerald-400/25 bg-emerald-500/4";
  const nameClass =
    row.status === "no_show" || row.status === "cancelled" ? "line-through" : "";
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border p-2.5 backdrop-blur transition-all",
        stateClass,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-md bg-secondary px-2 py-0.5 text-xs font-bold">
          {row.label}
        </div>
        <div className="min-w-0">
          <div className={cn("truncate text-sm font-semibold", nameClass)}>
            {row.patientName}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {fmtTime(row.slotTime)} ·{" "}
            <span className="capitalize">{row.status.replace("_", " ")}</span>
          </div>
        </div>
      </div>
      {!readOnly ? (
        <UndoOrReopenButton row={row} />
      ) : row.status === "no_show" ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">
          No-show
        </span>
      ) : row.status === "cancelled" ? (
        <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground">
          Cancelled
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-3" /> Done
        </span>
      )}
    </div>
  );
}

function UndoOrReopenButton({ row }: { row: Row }) {
  const [pending, start] = useTransition();
  const [, force] = useState(0);

  // Keep relative-time labels fresh while the strip is open.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 20_000);
    return () => clearInterval(id);
  }, []);

  if (row.status === "cancelled") {
    return <span className="text-[11px] text-muted-foreground">Cancelled</span>;
  }

  const completedMs = row.completedAt
    ? new Date(row.completedAt).getTime()
    : null;
  const ageSec = completedMs ? (Date.now() - completedMs) / 1000 : Infinity;

  // 0-30s: cheap silent undo
  if (row.isUndoable) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await undoDoneAction(row.bookingId);
          })
        }
      >
        <RotateCcw className="size-3.5" /> Undo
      </Button>
    );
  }

  if (row.status === "no_show") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await restoreNoShowAction(row.bookingId);
          })
        }
      >
        <RotateCcw className="size-3.5" /> Restore
      </Button>
    );
  }

  // 30s-10min: "Undo · 2m ago" + green confirmed dot once stale.
  // 10min+: "Reopen" prompting for a reason.
  const ageLabel = ageSec < 60 ? "just now" : `${Math.floor(ageSec / 60)}m ago`;
  const isStale = ageSec > 10 * 60;

  if (!isStale) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">{ageLabel}</span>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            const reason = prompt("Why are you reopening this booking?");
            if (!reason) return;
            start(async () => {
              await reopenAction(row.bookingId, reason);
            });
          }}
        >
          <RotateCcw className="size-3.5" /> Reopen
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground">{ageLabel}</span>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        title="Past undo window — reopen with a reason"
        onClick={() => {
          const reason = prompt("Why are you reopening this booking?");
          if (!reason) return;
          start(async () => {
            await reopenAction(row.bookingId, reason);
          });
        }}
      >
        Reopen
      </Button>
    </div>
  );
}

// ─── generic dropdown menu ───────────────────────────────────────────────

type MenuItem = {
  key: string;
  icon: React.ReactNode;
  label: string;
  confirm?: string;
  run: () => Promise<{ ok: boolean; error?: string }>;
};

function Menu({
  label,
  labelTitle,
  items,
}: {
  label: React.ReactNode;
  labelTitle?: string;
  items: MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const handle = (item: MenuItem) => {
    if (item.confirm && !confirm(item.confirm)) return;
    setError(null);
    start(async () => {
      const r = await item.run();
      if (r.ok) setOpen(false);
      else if (r.error) setError(r.error);
    });
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        size="icon"
        variant="ghost"
        className="size-8"
        title={labelTitle}
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : label}
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-card/95 shadow-xl backdrop-blur">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => handle(it)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-secondary"
              disabled={pending}
            >
              <span className="text-muted-foreground">{it.icon}</span>
              {it.label}
            </button>
          ))}
          {error ? (
            <div className="border-t border-border px-3 py-2 text-[11px] text-destructive">
              {error}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
