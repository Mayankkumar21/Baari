"use client";

import { motion } from "motion/react";
import { Building2, Clock, ListChecks } from "lucide-react";

type Step = {
  number: string;
  title: string;
  body: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const STEPS: Step[] = [
  {
    number: "01",
    title: "Name your business.",
    body: "Pick clinic, dental, salon, spa — whatever fits. Defaults are set for you.",
    icon: Building2,
  },
  {
    number: "02",
    title: "Set your hours.",
    body: "When are you open? When do you close? You can change this later.",
    icon: Clock,
  },
  {
    number: "03",
    title: "Take your first booking.",
    body: "Add a walk-in or a future appointment. The queue takes care of the rest.",
    icon: ListChecks,
  },
];

export function HowItWorks() {
  return (
    <section className="container py-20 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-xl text-center"
      >
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Up and running in two screens.
        </h2>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
        }}
        className="relative mt-12 grid gap-6 md:grid-cols-3"
      >
        {/* Connector line behind the cards on desktop. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[16%] right-[16%] top-12 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
        />

        {STEPS.map(({ number, title, body, icon: Icon }) => (
          <motion.div
            key={number}
            variants={{
              hidden: { opacity: 0, y: 14 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
            }}
            className="relative"
          >
            <div className="relative z-10 rounded-2xl border border-border bg-card/70 p-6 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="text-3xl font-extrabold tabular-nums text-primary/70">
                  {number}
                </span>
              </div>
              <h3 className="mt-5 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
