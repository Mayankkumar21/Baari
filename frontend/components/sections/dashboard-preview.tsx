"use client";

import { motion } from "motion/react";
import {
  Clock,
  Coffee,
  Stethoscope,
  Users,
  Check,
  ListOrdered,
  Search,
  BarChart3,
  Settings,
  Plus,
  Moon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────
   A pixel-true mock of Baari's queue dashboard, rendered as live HTML so
   it stays crisp at any resolution. Wrapped in a macOS-style window with
   a perspective tilt + gradient mask so it appears to be sliding into
   the page from below the hero.
   ───────────────────────────────────────────────────────────────────── */

function Pill({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "info" | "warn";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
        variant === "default" && "bg-secondary text-muted-foreground ring-border",
        variant === "success" && "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
        variant === "info" && "bg-primary/15 text-primary ring-primary/30",
        variant === "warn" && "bg-amber-500/15 text-amber-300 ring-amber-500/30"
      )}
    >
      {children}
    </span>
  );
}

function Counter({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-bold leading-none">{value}</div>
      {hint && <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Row({
  token,
  name,
  meta,
  status,
  subtoken,
}: {
  token: string;
  name: string;
  meta: string;
  status: "wait" | "late" | "done";
  subtoken?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5",
        status === "wait" && "border-border bg-card/60",
        status === "late" && "border-amber-500/30 bg-amber-500/10",
        status === "done" && "border-emerald-500/30 bg-emerald-500/10 opacity-70"
      )}
    >
      <div className="grid w-12 place-items-center rounded-md bg-secondary py-1.5 text-sm font-bold">
        {token}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{meta}</div>
        {subtoken && (
          <div className="mt-1">
            <Pill variant="success">
              <Check className="size-2.5" /> {subtoken}
            </Pill>
          </div>
        )}
      </div>
      {status === "wait" && (
        <button className="rounded-md border border-border bg-background/60 px-2.5 py-1 text-[11px] font-medium">
          Check in
        </button>
      )}
      {status === "late" && <Pill variant="warn">Late</Pill>}
      {status === "done" && (
        <Pill variant="success">
          <Check className="size-2.5" /> Done
        </Pill>
      )}
    </div>
  );
}

export function DashboardPreview() {
  return (
    <section className="relative -mt-8 pb-24 sm:pb-32">
      {/* Soft indigo wash behind the dashboard. */}
      <div
        aria-hidden
        className="orb pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 bg-primary/35"
      />

      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-5xl"
          style={{ perspective: "2000px" }}
        >
          <div
            className="overflow-hidden rounded-2xl border border-border bg-card/90 shadow-2xl shadow-primary/20 backdrop-blur ring-1 ring-white/5"
            style={{
              transform: "rotateX(10deg)",
              transformOrigin: "50% 100%",
              WebkitMaskImage:
                "linear-gradient(to bottom, black 0%, black 85%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, black 0%, black 85%, transparent 100%)",
            }}
          >
            {/* macOS-style window chrome */}
            <div className="flex items-center gap-2 border-b border-border bg-card/80 px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-full bg-red-500/80" />
                <div className="size-2.5 rounded-full bg-yellow-500/80" />
                <div className="size-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <div className="ml-3 flex items-center gap-1.5 rounded-md border border-border bg-background/70 px-2.5 py-1 text-[10px] text-muted-foreground">
                <div className="size-1.5 rounded-full bg-emerald-500" />
                app.baari.in/queue
              </div>
              <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="hidden sm:inline">Dr. Sharma · Sharma Homeopathy</span>
              </div>
            </div>

            {/* Top app nav inside the window */}
            <div className="flex items-center justify-between border-b border-border bg-card/60 px-5 py-2.5">
              <div className="flex items-center gap-1.5">
                <div className="grid size-5 place-items-center rounded-md bg-primary text-[10px] font-extrabold text-primary-foreground">
                  B
                </div>
                <div className="text-xs font-bold">Baari</div>
              </div>
              <div className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
                <div className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 font-medium text-foreground">
                  <ListOrdered className="size-3" /> Queue
                </div>
                <div className="flex items-center gap-1 px-2 py-1">
                  <Search className="size-3" /> Search
                </div>
                <div className="flex items-center gap-1 px-2 py-1">
                  <BarChart3 className="size-3" /> Reports
                </div>
                <div className="flex items-center gap-1 px-2 py-1">
                  <Settings className="size-3" /> Settings
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                  <Plus className="mr-0.5 inline size-3" /> New booking
                </button>
                <button className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium">
                  <Moon className="mr-0.5 inline size-3" /> Close day
                </button>
              </div>
            </div>

            {/* Page content */}
            <div className="p-5">
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    18 Jun 2026, 10:42 · IST
                  </div>
                  <div className="text-base font-bold">Today's queue</div>
                </div>
              </div>

              {/* Counter row */}
              <div className="mb-4 grid grid-cols-4 gap-3">
                <Counter label="Booked today" value={18} />
                <Counter label="Waiting" value={5} />
                <Counter label="Done" value={12} />
                <Counter label="No-show" value={1} />
              </div>

              {/* Two-column body */}
              <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
                {/* Waiting list */}
                <div className="rounded-xl border border-border bg-background/60 p-3.5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Waiting
                    </div>
                    <div className="text-[11px] text-muted-foreground">5</div>
                  </div>
                  <div className="space-y-2">
                    <Row token="T13" name="Anjali Verma" meta="10:40 · headache, fever" status="wait" />
                    <Row
                      token="T14"
                      name="Ravi Kumar"
                      meta="11:00 · party of 2"
                      status="wait"
                      subtoken="T14.1 · Priya Kumar"
                    />
                    <Row token="T15" name="Sneha Iyer" meta="11:20" status="late" />
                    <Row token="T16" name="अमित शर्मा" meta="11:40 · skin allergy" status="wait" />
                    <Row token="T17" name="Karan Mehta" meta="12:00" status="wait" />
                  </div>
                </div>

                {/* Now consulting + Done */}
                <div className="space-y-3">
                  <div className="rounded-xl border border-primary/40 bg-card p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Now consulting
                      </div>
                      <Pill variant="info">
                        <Stethoscope className="size-2.5" /> In consult
                      </Pill>
                    </div>
                    <div className="text-[10px] text-muted-foreground">Token</div>
                    <div className="bg-clip-text text-3xl font-extrabold leading-none text-primary">
                      T12
                    </div>
                    <div className="mt-2 text-sm font-semibold">Meera Pillai</div>
                    <div className="text-[11px] text-muted-foreground">cold, sore throat</div>
                    <div className="mt-3 flex items-center gap-2">
                      <button className="flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-emerald-500/40">
                        <Check className="size-3" /> Mark done
                      </button>
                      <button className="flex items-center gap-1 rounded-md border border-border bg-background/70 px-3 py-1.5 text-[11px] font-medium">
                        <Users className="size-3" /> Add family member
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background/60 p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Done today
                      </div>
                      <div className="text-[11px] text-muted-foreground">12</div>
                    </div>
                    <div className="space-y-2">
                      <Row
                        token="T11"
                        name="Sahil Khanna"
                        meta="10:20 · back pain"
                        status="done"
                      />
                      <Row
                        token="T10"
                        name="Priya Singh"
                        meta="10:00 · checkup"
                        status="done"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
