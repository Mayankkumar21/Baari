"use client";

import { motion } from "motion/react";
import {
  ListOrdered,
  Users,
  MessageSquareText,
  TimerOff,
  BarChart3,
  Globe,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  title: string;
  body: string;
  icon: LucideIcon;
};

const FEATURES: Feature[] = [
  {
    title: "Live token queue",
    body: "Side-by-side waiting and now-serving view, auto-refresh every 10 seconds. One-click check-in and mark-done — no menu diving.",
    icon: ListOrdered,
  },
  {
    title: "Family sub-tokens",
    body: "When a customer brings family, attach T5.1, T5.2 mid-session. The queue auto-advances through them before promoting the next token.",
    icon: Users,
  },
  {
    title: "WhatsApp built-in",
    body: "Bilingual confirmations, you're-next pings, no-show notices and cancellations. Honors per-customer opt-outs.",
    icon: MessageSquareText,
  },
  {
    title: "No-show automation",
    body: "Anyone past their slot beyond the threshold is auto-marked no-show and notified. One-click restore when they show up late.",
    icon: TimerOff,
  },
  {
    title: "End-of-day reports",
    body: "Closes the day automatically, generates a summary, and keeps a 30-day history with hourly trends — for the owner only.",
    icon: BarChart3,
  },
  {
    title: "English + हिन्दी",
    body: "Both scripts, every screen. Toggle once — staff and customers see the language they prefer.",
    icon: Globe,
  },
];

export function Features() {
  return (
    <section className="container py-20 sm:py-28">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-2xl text-center"
      >
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Everything your front desk does, on one screen.
        </h2>
        <p className="mt-4 text-balance text-muted-foreground">
          Built for the realities of an Indian SME: bilingual UI, WhatsApp-first notifications,
          family group consults, late patients, and the receptionist who has to keep it all
          straight.
        </p>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
        }}
        className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {FEATURES.map(({ title, body, icon: Icon }) => (
          <motion.div
            key={title}
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
            }}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card/70 p-6 backdrop-blur transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
          >
            {/* Soft glow that activates on hover */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(600px circle at var(--mx,50%) var(--my,0%), hsl(var(--primary) / 0.10), transparent 40%)",
              }}
            />
            <Icon className="size-6 text-primary" />
            <h3 className="mt-4 text-base font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
