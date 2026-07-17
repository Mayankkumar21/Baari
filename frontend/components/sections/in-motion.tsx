"use client";

// The "In motion" section — a live-looping mock of the actual product,
// embedded via <iframe> from /demo.html. Chosen over a video file for
// three reasons: (1) tiny bundle (~25 KB vs multi-MB MP4), (2) pixel-
// perfect at any device DPI, no compression artefacts, (3) instant
// iteration — edit the demo file, refresh, done.
//
// The iframe holds a 1440×900 stage rendered under a fixed
// aspect-ratio wrapper so it scales cleanly across breakpoints. Loop
// is ~15s: queue busy → reports payoff → insights trio. No sound.

import { motion } from "motion/react";

export function InMotion() {
  return (
    <section className="container pb-20 sm:pb-28">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-3xl text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          In motion
        </div>
        <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          A Tuesday, sped up.
        </h2>
        <p className="mt-4 text-balance text-base text-muted-foreground sm:text-lg">
          Queue absorbing a rush · reports building at the counter · the
          insights that fall out by evening. No commentary, no music — just
          the product doing what it does.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto mt-12 max-w-6xl"
      >
        {/* Glow + frame wrapper. The negative-margin orbs mirror the
            treatment on the queue preview mock in the hero. */}
        <div className="relative">
          <div className="orb pointer-events-none absolute -left-16 -top-16 h-[360px] w-[360px] bg-primary/25" />
          <div className="orb pointer-events-none absolute -bottom-16 -right-16 h-[320px] w-[320px] bg-primary/20" />

          <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60 shadow-2xl shadow-primary/20 ring-1 ring-white/5 backdrop-blur">
            {/* Chrome — same macOS-style window as the hero preview,
                to keep the "you're looking at the real app" cue. */}
            <div className="flex items-center gap-2 border-b border-border/60 bg-card/80 px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-full bg-red-500/80" />
                <div className="size-2.5 rounded-full bg-yellow-500/80" />
                <div className="size-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <div className="ml-2 flex items-center gap-1.5 rounded-md border border-border bg-background/70 px-2.5 py-1 text-[10px] text-muted-foreground">
                <div className="size-1.5 rounded-full bg-emerald-500" />
                getbaari.in
              </div>
            </div>

            {/* Fixed aspect wrapper so the iframe scales instead of
                letterboxing awkwardly. 1440×900 → 16:10. */}
            <div className="relative w-full" style={{ aspectRatio: "1440 / 900" }}>
              <iframe
                src="/demo.html"
                title="Baari in motion"
                loading="lazy"
                aria-label="Live loop of the Baari dashboard on a busy Tuesday"
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
