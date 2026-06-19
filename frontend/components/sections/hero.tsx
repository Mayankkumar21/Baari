"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";


export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-32">
      {/* Soft gradient orbs in the background */}
      <div className="orb left-[10%] top-[-10%] h-[420px] w-[420px] bg-primary/40" />
      <div className="orb right-[5%] top-[20%] h-[360px] w-[360px] bg-primary/25" />

      {/* Subtle grid texture */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.04] dark:opacity-[0.06] [background-image:linear-gradient(to_right,hsl(var(--foreground))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground))_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <div className="container relative text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="size-3.5 text-primary" />
            One dashboard. Every appointment.
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="mt-7 text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-[64px]"
        >
          The <span className="text-gradient">paper register</span>
          <br className="hidden sm:block" /> your front desk replaces.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-6 max-w-xl text-balance text-base text-muted-foreground sm:text-lg"
        >
          Baari is a live queue and booking dashboard for any business where customers wait for a
          sequential service. Tokens, family sub-tokens, no-show automation, WhatsApp reminders —
          all on one screen.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <Button variant="glow" size="xl" asChild>
            <Link href={`/signup`}>
              Start for free <ArrowRight className="size-5" />
            </Link>
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-8 text-xs text-muted-foreground"
        >
          Free during the early-access period. No card required.
        </motion.p>
      </div>
    </section>
  );
}
