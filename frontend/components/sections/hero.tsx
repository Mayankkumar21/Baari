"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Check, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";


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
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80 backdrop-blur">
              The register that reads itself
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-[64px]"
          >
            Your paper register,<br className="hidden sm:block" />{" "}
            <span className="text-gradient">but it does the math.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 max-w-xl text-balance text-base text-muted-foreground sm:text-lg"
          >
            Baari runs your queue, walk-ins, and bookings — and quietly turns every visit
            into the picture your paper register was never going to show. Silent churn
            (who stopped coming). Category revenue (what actually pays). Cohort
            retention (who came back). Numbers you can act on.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.20, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 max-w-xl text-sm text-muted-foreground/80"
          >
            Built for clinics and salons. Works anywhere a customer waits their turn.
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
              <Link href="/login">Sign in</Link>
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.36 }}
            className="mt-6 text-sm text-foreground/75"
          >
            60 days of Pro on us. After that, <strong className="text-foreground">₹999/mo</strong> or stay Free
            under 100 customers/month. No card.
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
    <div className="relative">
      {/* Floating callout — points at the Mark Done button below with
          a bent connector line. This is what makes the mock feel like
          marketing art rather than a screenshot: something in the
          image is EXPLAINING itself. */}
      <div className="absolute -left-6 -top-6 z-10 hidden lg:block">
        <div className="relative">
          <div className="inline-flex flex-col items-start rounded-xl border border-primary/40 bg-primary/15 px-4 py-3 shadow-lg shadow-primary/20 backdrop-blur">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              One tap
            </div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">
              → recorded forever.
            </div>
          </div>
          {/* Bent arrow SVG from callout tail toward the Mark Done button */}
          <svg
            className="absolute left-8 top-full h-16 w-24 text-primary/60"
            viewBox="0 0 96 64"
            fill="none"
            aria-hidden
          >
            <path
              d="M 8 4 Q 8 40 60 52"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="3 4"
            />
            <path
              d="M 54 48 L 62 54 L 55 58"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      </div>

      {/* The mock itself — just the "In Consult" moment, blown up. No
          waiting list, no counters, no busywork; the whole point of
          the mock is to show the "Mark done" gesture that produces a
          data point. */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border bg-card/90 shadow-2xl shadow-primary/25 ring-1 ring-white/5 backdrop-blur"
        style={{
          transform: "rotateY(-6deg) rotateX(4deg)",
          transformOrigin: "60% 50%",
        }}
      >
        {/* macOS window chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-card/80 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full bg-red-500/80" />
            <div className="size-2.5 rounded-full bg-yellow-500/80" />
            <div className="size-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <div className="ml-2 flex items-center gap-1.5 rounded-md border border-border bg-background/70 px-2.5 py-0.5 text-[11px] text-muted-foreground">
            <div className="size-1.5 rounded-full bg-emerald-500" />
            getbaari.in/queue
          </div>
        </div>

        <div className="p-6">
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-300">
                In consult
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                <Stethoscope className="size-3" /> T12
              </span>
            </div>
            <div className="mt-3 text-2xl font-bold leading-tight">Emma Wilson</div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              cold, sore throat
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Started 10:47 · 27 min in
            </div>
            <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40">
              <Check className="size-4" /> Mark done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

