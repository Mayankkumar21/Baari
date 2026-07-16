"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Check, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
      {/* Soft gradient orbs in the background */}
      <div className="orb left-[10%] top-[-10%] h-[420px] w-[420px] bg-primary/40" />
      <div className="orb right-[5%] top-[20%] h-[360px] w-[360px] bg-primary/25" />

      {/* Subtle grid texture */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.04] dark:opacity-[0.06] [background-image:linear-gradient(to_right,hsl(var(--foreground))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground))_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <div className="container relative grid items-center gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
        {/* Left: copy + CTAs */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
              Run your day. Know your year.
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-[64px]"
          >
            Know your business.<br className="hidden sm:block" />{" "}
            <span className="text-gradient">Grow your business.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 max-w-xl text-balance text-base text-muted-foreground sm:text-lg"
          >
            Baari runs your queue, walk-ins, and bookings — and quietly turns every visit into
            the picture your paper register never could give you. Which regulars ghosted. Which
            service actually pays. Where your first-timers come from.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button variant="glow" size="xl" asChild>
              <Link href="/signup">
                Start free <ArrowRight className="size-5" />
              </Link>
            </Button>
            <Button variant="outline" size="xl" asChild>
              <Link href="/login">I already have an account</Link>
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.36 }}
            className="mt-6 text-xs text-muted-foreground"
          >
            60 days of the top plan on us. No card. Not another queue app — the intelligence
            layer under your day.
          </motion.p>
        </div>

        {/* Right: floating compact dashboard preview at a slight tilt */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
          style={{ perspective: "1800px" }}
        >
          <CompactQueuePreview />
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Compact dashboard preview — mirrors what /queue looks like today.
   Uses the unified status colour system: emerald for active / done,
   primary for waiting, amber for late.
   ───────────────────────────────────────────────────────────────────── */

function CompactQueuePreview() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-card/90 shadow-2xl shadow-primary/25 ring-1 ring-white/5 backdrop-blur"
      style={{
        transform: "rotateY(-6deg) rotateX(4deg)",
        transformOrigin: "60% 50%",
      }}
    >
      {/* macOS window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-card/80 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <div className="size-2 rounded-full bg-red-500/80" />
          <div className="size-2 rounded-full bg-yellow-500/80" />
          <div className="size-2 rounded-full bg-emerald-500/80" />
        </div>
        <div className="ml-2 flex items-center gap-1.5 rounded-md border border-border bg-background/70 px-2 py-0.5 text-[9px] text-muted-foreground">
          <div className="size-1.5 rounded-full bg-emerald-500" />
          getbaari.in/queue
        </div>
      </div>

      <div className="p-3.5">
        {/* Summary line */}
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <div className="text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
              Today
            </div>
            <div className="text-sm font-bold leading-tight">5 waiting · 1 in consult</div>
          </div>
          <div className="text-[9px] tabular-nums text-muted-foreground">10:42</div>
        </div>

        {/* Now in session card */}
        <div className="mb-3 rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
              In consult
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-700 dark:text-emerald-200">
              <Stethoscope className="size-2.5" /> T12
            </span>
          </div>
          <div className="mt-1 text-[13px] font-semibold leading-tight">Emma Wilson</div>
          <div className="text-[10px] text-muted-foreground">cold, sore throat</div>
          <button className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-white shadow-sm shadow-emerald-500/40">
            <Check className="size-2.5" /> Mark done
          </button>
        </div>

        {/* Waiting list */}
        <div className="mb-1 flex items-center justify-between text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <span>Waiting</span>
          <span>5</span>
        </div>
        <div className="space-y-1.5">
          <MiniRow token="T13" name="Sarah Chen" meta="10:40 · headache" tone="wait" />
          <MiniRow token="T14" name="James Park" meta="11:00 · party of 2" tone="wait" />
          <MiniRow token="T15" name="Priya Sharma" meta="11:20" tone="late" />
          <MiniRow token="T16" name="Sundar Rao" meta="11:40 · skin" tone="wait" />
        </div>
      </div>
    </div>
  );
}

function MiniRow({
  token,
  name,
  meta,
  tone,
}: {
  token: string;
  name: string;
  meta: string;
  tone: "wait" | "late";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-1.5",
        tone === "wait" && "border-primary/30 bg-primary/5",
        tone === "late" && "border-amber-400/40 bg-amber-500/10",
      )}
    >
      <div className="grid w-8 place-items-center rounded bg-secondary py-0.5 text-[10px] font-bold tabular-nums">
        {token}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-semibold leading-tight">{name}</div>
        <div className="truncate text-[9px] text-muted-foreground">{meta}</div>
      </div>
      {tone === "late" && (
        <span className="rounded-full border border-amber-400/50 bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-semibold text-amber-700 dark:text-amber-300">
          Late
        </span>
      )}
    </div>
  );
}
