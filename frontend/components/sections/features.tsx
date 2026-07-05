"use client";

import { motion } from "motion/react";
import { Check, Stethoscope, UserPlus, Undo2 } from "lucide-react";

import { cn } from "@/lib/utils";

type Feature = {
  eyebrow: string;
  title: string;
  body: string;
  visual: React.ReactNode;
};

export function Features() {
  const features: Feature[] = [
    {
      eyebrow: "Live queue",
      title: "No more shouting names across the room.",
      body: "See who's here, who's next, who's running late. One click to check them in, one click to mark them done. Updates live, on every screen in the clinic.",
      visual: <LiveQueueVisual />,
    },
    {
      eyebrow: "One queue. Walk-ins + bookings.",
      title: "Walk-ins and bookings, on the same screen.",
      body: "Most queue apps make you choose — appointments only, or a deli-style ticket dispenser. Baari handles both. The receptionist adds a walk-in in two taps, and the queue figures out the order.",
      visual: <MixedQueueVisual />,
    },
    {
      eyebrow: "Late + no-show",
      title: "Late patients, handled before they call.",
      body: "Anyone past their slot is automatically flagged as late. When it's time, one tap marks them no-show — the next customer moves up. If they walk in five minutes later, one tap restores them.",
      visual: <NoShowVisual />,
    },
  ];

  return (
    <section className="container py-20 sm:py-28">
      <div className="space-y-24 sm:space-y-32">
        {features.map((feature, i) => (
          <FeatureBlock key={feature.eyebrow} feature={feature} reverse={i % 2 === 1} />
        ))}
      </div>
    </section>
  );
}

function FeatureBlock({ feature, reverse }: { feature: Feature; reverse: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "grid items-center gap-10 lg:grid-cols-2 lg:gap-16",
        reverse && "lg:[&>div:first-child]:order-2",
      )}
    >
      {/* Visual */}
      <div className="relative">
        <div className="orb pointer-events-none absolute -left-10 -top-10 h-[260px] w-[260px] bg-primary/25" />
        <div className="relative">{feature.visual}</div>
      </div>

      {/* Copy */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          {feature.eyebrow}
        </div>
        <h3 className="mt-3 text-balance text-2xl font-bold tracking-tight sm:text-3xl">
          {feature.title}
        </h3>
        <p className="mt-4 text-balance text-base leading-relaxed text-muted-foreground">
          {feature.body}
        </p>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Visuals — small inline UI snippets, matching the unified status colours
   used across /queue. No copying images: these stay crisp on any screen.
   ───────────────────────────────────────────────────────────────────── */

function PanelChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-xl shadow-primary/10 ring-1 ring-white/5 backdrop-blur">
      {children}
    </div>
  );
}

function LiveQueueVisual() {
  return (
    <PanelChrome>
      <div className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
        {/* Waiting list */}
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span>Waiting</span>
            <span>4</span>
          </div>
          <div className="space-y-1.5">
            <QueueRow token="T13" name="Anjali Verma" meta="10:40 · headache" tone="wait" />
            <QueueRow token="T14" name="Ravi Kumar" meta="11:00 · party of 2" tone="wait" />
            <QueueRow token="T15" name="Sneha Iyer" meta="11:20" tone="late" />
            <QueueRow token="T16" name="अमित शर्मा" meta="11:40 · skin" tone="wait" />
          </div>
        </div>

        {/* Now in session */}
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
              In consult
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-200">
              <Stethoscope className="size-2.5" />
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground">Token</div>
          <div className="text-3xl font-extrabold leading-none text-emerald-700 dark:text-emerald-300">
            T7
          </div>
          <div className="mt-1.5 text-sm font-semibold">Meera Pillai</div>
          <div className="text-[11px] text-muted-foreground">cold, sore throat</div>
          <button className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-emerald-500/40">
            <Check className="size-3" /> Mark done
          </button>
        </div>
      </div>
    </PanelChrome>
  );
}

function MixedQueueVisual() {
  return (
    <PanelChrome>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Today&apos;s queue
        </div>
        <button className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
          <UserPlus className="size-3" /> Walk in
        </button>
      </div>
      <div className="space-y-1.5">
        <QueueRow token="T11" name="Booked · 10:30" meta="Rohit Sen · checkup" tone="wait" sourceTag="booked" />
        <QueueRow token="T12" name="Walk-in · 10:38" meta="Riya Shah · skin" tone="wait" sourceTag="walkin" />
        <QueueRow token="T13" name="Booked · 11:00" meta="Anjali Verma" tone="wait" sourceTag="booked" />
        <QueueRow token="T14" name="Walk-in · 11:06" meta="Akhil M · fever" tone="wait" sourceTag="walkin" />
        <QueueRow token="T15" name="Booked · 11:20" meta="Sneha Iyer" tone="late" sourceTag="booked" />
      </div>
      <p className="mt-3 text-[10px] leading-snug text-muted-foreground">
        Walk-ins slot in between bookings by arrival time. The receptionist never has to think
        about ordering.
      </p>
    </PanelChrome>
  );
}

function NoShowVisual() {
  return (
    <PanelChrome>
      <div className="space-y-2">
        <QueueRow token="T15" name="Sneha Iyer" meta="11:20 · 12 min late" tone="late" />
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <div className="grid size-7 place-items-center rounded-md bg-secondary text-[10px] font-bold tabular-nums">
                  T15
                </div>
                <div>
                  <div className="text-sm font-semibold line-through opacity-70">Sneha Iyer</div>
                  <div className="text-[10px] text-muted-foreground">marked no-show · 11:35</div>
                </div>
              </div>
            </div>
            <span className="rounded-full border border-rose-400/50 bg-rose-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              No-show
            </span>
          </div>
        </div>

        {/* Undo toast */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-background/80 p-2.5 shadow-lg shadow-black/20 backdrop-blur">
          <div className="flex items-center gap-2 text-xs">
            <span className="grid size-6 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
              <Check className="size-3" />
            </span>
            <span>Marked no-show</span>
          </div>
          <button className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
            <Undo2 className="size-3" /> Undo
          </button>
        </div>
      </div>
    </PanelChrome>
  );
}

function QueueRow({
  token,
  name,
  meta,
  tone,
  sourceTag,
}: {
  token: string;
  name: string;
  meta: string;
  tone: "wait" | "late";
  sourceTag?: "booked" | "walkin";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-2.5 py-2",
        tone === "wait" && "border-primary/25 bg-primary/5",
        tone === "late" && "border-amber-400/40 bg-amber-500/10",
      )}
    >
      <div className="grid w-10 place-items-center rounded-md bg-secondary py-1 text-xs font-bold tabular-nums">
        {token}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold leading-tight">{name}</div>
        <div className="truncate text-[10px] text-muted-foreground">{meta}</div>
      </div>
      {sourceTag === "walkin" && (
        <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
          walk-in
        </span>
      )}
      {sourceTag === "booked" && (
        <span className="rounded-full border border-border bg-card px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
          booked
        </span>
      )}
      {tone === "late" && !sourceTag && (
        <span className="rounded-full border border-amber-400/50 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
          Late
        </span>
      )}
    </div>
  );
}
