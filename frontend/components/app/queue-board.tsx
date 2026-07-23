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
  Repeat,
  RotateCcw,
  Stethoscope,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { fmtTime } from "@/lib/time";

// Context so sub-components (NowCard, WaitingRow, DoneRow, reschedule
// popover…) can format wall-clock strings without every parent having
// to thread `tz` into every child prop. QueueBoard sets it once at the
// top from the clinic's timezone.
const TzContext = createContext<string>("Asia/Kolkata");
function useTz(): string {
  return useContext(TzContext);
}

// Country-picker default for walk-in / new-booking forms rendered
// inside the queue board. Derived once at the top from the owner's
// login mobile so a US clinic's picker doesn't stay pinned at +91.
// Undefined string means "no preference — let the picker auto-detect
// like on the login page."
const DefaultCountryContext = createContext<string | undefined>(undefined);
function useDefaultCountryCode(): string | undefined {
  return useContext(DefaultCountryContext);
}
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CountryCodePicker,
  useCountry,
} from "@/components/country-code-picker";
import { cn } from "@/lib/utils";
import { BookForm, type SlotInfo } from "@/app/(app)/book/book-form";
import {
  cancelAction,
  checkInAction,
  closeDayAction,
  markDoneAction,
  markNoShowAction,
  reopenAction,
  rescheduleAction,
  restoreNoShowAction,
  sendReminderAction,
  startConsultAction,
  undoDoneAction,
  walkInAction,
} from "@/app/(app)/queue/actions";

// ─── types ────────────────────────────────────────────────────────────────

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
  // Loyalty snapshot for the row — powers the "5th visit · last Nov 3"
  // subline. 0 pastVisits means first time; row falls back to the
  // regular meta line without the loyalty subline.
  pastVisits: number;
  lastVisitDate: string | null;
};

type NowConsulting = {
  label: string;
  patientName: string;
  reason: string | null;
  bookingId: number;
  startedAt: string | null;
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
  categories,
  quota,
  tz,
  defaultCountryCode,
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
  // Suggested revenue categories for the Mark Done popover. Null on
  // Free plans — the picker is Growth-tier.
  categories: string[] | null;
  // Monthly plan cap state — server-computed, passed in so the banner
  // matches what the guards on booking-creation will actually enforce.
  quota: {
    plan: string;
    used: number;
    cap: number | null;
    isOverCap: boolean;
    isNearCap: boolean;
    monthLabel: string;
  };
  // Clinic's IANA timezone — used for every wall-clock render on the
  // board and threaded down to nested components (row cards, walk-in,
  // book form). Comes from sess.clinic.timezone.
  tz: string;
  // Owner's country code, derived server-side from their login mobile.
  // Threaded via context into walk-in + book-form pickers so a US
  // clinic doesn't have to switch from +91 on every patient.
  defaultCountryCode?: string;
}) {
  const [bookOpen, setBookOpen] = useState(false);
  return (
    <TzContext.Provider value={tz}>
    <DefaultCountryContext.Provider value={defaultCountryCode}>
    <div className="space-y-5">
      {quota.cap !== null && (quota.isNearCap || quota.isOverCap) ? (
        <QuotaBanner
          used={quota.used}
          cap={quota.cap}
          isOverCap={quota.isOverCap}
          monthLabel={quota.monthLabel}
        />
      ) : null}
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">
            {generatedAtLabel} · {tz}
            {isClosed ? <span className="ml-2 text-primary">· closed</span> : null}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Queue</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isClosed && isDoctor ? (
            <div data-tour-id="close-day">
              <CloseDayButton activeCount={summary.waiting + summary.inSession} />
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
              <NowCard nc={nowConsulting} vocab={vocab} readOnly={isClosed} categories={categories} />
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
    </DefaultCountryContext.Provider>
    </TzContext.Provider>
  );
}

// Ordinal suffix — "1st", "2nd", "3rd", "4th", etc. Handles the
// English teens (11th, 12th, 13th) correctly.
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

// "Last visit 12 Nov 2025" / "Last visit yesterday" / "Last visit
// 3 days ago" — keeps the copy on the queue row scannable.
function fmtLastVisit(isoDate: string): string {
  // isoDate is YYYY-MM-DD from the aggregate. Use noon-IST to dodge
  // TZ off-by-ones on the "days ago" math.
  const then = new Date(`${isoDate}T12:00:00+05:30`).getTime();
  const now = Date.now();
  const days = Math.floor((now - then) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  const d = new Date(then);
  const day = d.getDate();
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][d.getMonth()];
  return `${day} ${month}`;
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
  const tz = useTz();
  const defaultCountryCode = useDefaultCountryCode();
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
            tz={tz}
            defaultCountryCode={defaultCountryCode}
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

function CloseDayButton({ activeCount }: { activeCount: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        // Two-tier confirmation. If patients are still waiting or in
        // session, the message names the count so the doctor doesn't
        // accidentally no-show real people ("Close the day?" was too
        // abstract — nobody knew they were about to mark 3 patients
        // as no-shows). A clean day (zero active) still asks, but the
        // wording is soft since no one is affected.
        const msg =
          activeCount > 0
            ? `${activeCount} ${activeCount === 1 ? "patient is" : "patients are"} still waiting or in session. Closing the day will mark ${activeCount === 1 ? "them" : "all of them"} as NO-SHOW. Consider finishing them first.\n\nClose anyway?`
            : "Close today's queue? The board becomes read-only for the rest of the day.";
        if (!confirm(msg)) return;
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
  // Country + national number split like login/signup — combined into
  // an E.164 hidden field the server action reads. Pre-filled with
  // the owner's own country (from their login mobile) so a US clinic
  // isn't fighting a +91 default every walk-in.
  const [country, setCountry] = useCountry(useDefaultCountryCode());
  const [national, setNational] = useState("");
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
              <div className="flex gap-2">
                <CountryCodePicker value={country} onChange={setCountry} />
                <Input
                  id="walkin_mobile"
                  type="tel"
                  inputMode="numeric"
                  maxLength={15}
                  required
                  placeholder="Mobile number"
                  value={national}
                  onChange={(e) =>
                    setNational(e.target.value.replace(/[^\d\s\-().]/g, "").slice(0, 15))
                  }
                  className="flex-1"
                />
              </div>
              {/* Hidden E.164 field — the server action reads this. */}
              <input
                type="hidden"
                name="mobile"
                value={national ? `+${country.dial}${national.replace(/\D/g, "")}` : ""}
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

function QuotaBanner({
  used,
  cap,
  isOverCap,
  monthLabel,
}: {
  used: number;
  cap: number;
  isOverCap: boolean;
  monthLabel: string;
}) {
  const pct = Math.min(100, Math.round((used / cap) * 100));
  const tone = isOverCap
    ? "border-rose-400/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
    : "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return (
    <div className={"flex items-center justify-between gap-3 rounded-lg border px-4 py-3 " + tone}>
      <div className="min-w-0">
        <div className="text-sm font-semibold">
          {isOverCap
            ? `Monthly booking cap reached (${used}/${cap})`
            : `${pct}% of your monthly bookings used (${used}/${cap})`}
        </div>
        <div className="mt-0.5 text-xs opacity-80">
          {isOverCap
            ? `New bookings paused until ${monthLabel} ends. Existing ones still complete normally.`
            : `Resets at the start of next month. Upgrade for a bigger cap.`}
        </div>
      </div>
      <a
        href="/pricing"
        className="shrink-0 rounded-md border border-current px-3 py-1 text-xs font-semibold hover:bg-current/10"
      >
        Upgrade
      </a>
    </div>
  );
}

function NowCard({
  nc,
  vocab,
  readOnly,
  categories,
}: {
  nc: NowConsulting;
  vocab: Vocab;
  readOnly: boolean;
  categories: string[] | null;
}) {
  const [pending, start] = useTransition();
  const tz = useTz();
  const startedAtLabel = nc.startedAt ? fmtTime(nc.startedAt, tz) : null;
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

      {!readOnly ? (
        <div className="relative mt-6 flex flex-wrap gap-2">
          <MarkDoneButton
            bookingId={nc.bookingId}
            pending={pending}
            start={start}
            categories={categories}
          />
        </div>
      ) : null}
    </div>
  );
}

// Two-step mark-done: click reveals a small "amount paid" popover
// inline, click Save to record. Amount is optional — an empty submit
// still marks the booking done, just without a revenue number. This
// keeps the fast path (one click, no amount) alive for owners who
// don't care about revenue tracking, while unlocking the analytics
// for the ones who do.
function MarkDoneButton({
  bookingId,
  pending,
  start,
  categories,
}: {
  bookingId: number;
  pending: boolean;
  start: React.TransitionStartFunction;
  categories: string[] | null;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  // Pre-select the first category so it defaults IN — the revenue
  // report was staying empty because every "Mark done" left category
  // null. Owners can still change or clear it via the chip below.
  const [category, setCategory] = useState<string | null>(
    categories && categories.length > 0 ? categories[0] : null,
  );
  const submit = (withAmount: boolean) => {
    const n = withAmount ? Number(amount.trim()) : NaN;
    const clean =
      Number.isFinite(n) && n > 0 && n < 1_000_000 ? Math.round(n) : null;
    start(async () => {
      await markDoneAction(bookingId, clean, category);
      setOpen(false);
      setAmount("");
      // Reset to the same pre-selected default for the next booking.
      setCategory(categories && categories.length > 0 ? categories[0] : null);
    });
  };
  return (
    <div className="relative">
      <Button
        variant="success"
        size="lg"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
      >
        <CheckCircle2 className="size-4" /> Mark done
      </Button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-lg border border-border bg-card/95 p-3 shadow-xl backdrop-blur">
          <Label htmlFor="mark-done-amount" className="mb-1 block text-xs">
            Amount paid <span className="text-muted-foreground">(₹)</span>
          </Label>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-muted-foreground">₹</div>
            <Input
              id="mark-done-amount"
              type="number"
              min={0}
              max={999999}
              inputMode="numeric"
              placeholder="e.g. 350"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submit(true);
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          {categories && categories.length > 0 ? (
            <>
              <div className="mt-2 mb-1 text-xs text-muted-foreground">
                Category
              </div>
              <div className="flex flex-wrap gap-1">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(category === c ? null : c)}
                    className={
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all " +
                      (category === c
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground")
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {/* Small nudge so the receptionist knows why the field is
              there. Revenue reports were staying empty because
              "Skip amount" felt like an equal-weight option. */}
          <p className="mt-2 text-[10px] text-muted-foreground">
            Fills your revenue report — leave blank only if this
            visit is free.
          </p>
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={pending}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
            >
              Skip
            </button>
            <Button
              type="button"
              size="sm"
              variant="glow"
              onClick={() => submit(true)}
              disabled={pending}
            >
              Save
            </Button>
          </div>
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
  const tz = useTz();

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
            {/* Loyalty chip — one glance and the doctor knows if this
                is a first-time patient or a longtime regular. Only
                shown when we have prior visits to report on. */}
            {row.pastVisits > 0 ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                title={
                  row.lastVisitDate
                    ? `Last visit: ${row.lastVisitDate}`
                    : undefined
                }
              >
                <Repeat className="size-2.5" />
                {ordinal(row.pastVisits + 1)} visit
              </span>
            ) : null}
            {row.isLate ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                <AlertTriangle className="size-2.5" /> Late · {row.minutesLate} min
              </span>
            ) : null}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            <span>{fmtTime(row.slotTime, tz)}</span>
            {row.reason ? (
              <>
                {" · "}
                <span>{row.reason}</span>
              </>
            ) : null}
            {row.lastVisitDate ? (
              <>
                {" · "}
                <span>Last visit {fmtLastVisit(row.lastVisitDate)}</span>
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
  const tz = useTz();
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
                {fmtTime(iso, tz)}
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
  const tz = useTz();
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
            {fmtTime(row.slotTime, tz)} ·{" "}
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
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Computed screen coordinates for the portal-rendered panel. We can't
  // just use `absolute right-0 top-full` any more — every queue row has
  // backdrop-blur, which creates a stacking context that traps an
  // absolutely-positioned child no matter how high its z-index goes.
  // The next row's backdrop-blur then paints over the menu.
  //
  // Fix: render the menu in a document.body portal (escapes every
  // parent stacking context) and align it to the button with fixed
  // coordinates computed on open + on scroll/resize.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const reposition = () => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
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
    <div className="relative">
      <Button
        ref={btnRef}
        size="icon"
        variant="ghost"
        className="size-8"
        title={labelTitle}
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : label}
      </Button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              // z-50 (above the queue rows AND above the BookPanel's
              // z-index-40 backdrop, matching the reschedule modal's
              // z-40 sits below). Portaled to body so backdrop-blur on
              // ancestors can't clip it.
              style={{ position: "fixed", top: pos.top, right: pos.right }}
              className="z-50 w-56 overflow-hidden rounded-lg border border-border bg-card/95 shadow-xl backdrop-blur"
            >
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
