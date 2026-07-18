"use client";

// "The collection layer" section — three text-first blocks explaining
// why the queue features are the mechanism behind the analytics. NOT
// the same as InMotion (which shows the actual product animated). This
// section is scannable prose with a big number, not another mock UI
// that competes with the demo iframe above.

import { motion } from "motion/react";
import { CheckCircle2, GitMerge, XCircle } from "lucide-react";

type Feature = {
  eyebrow: string;
  title: string;
  body: string;
  stat: string;
  statLabel: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

export function Features() {
  const features: Feature[] = [
    {
      eyebrow: "Check-ins",
      title: "Every check-in is a data point.",
      body: "See who's here, who's next, who's running late. One tap in, one tap done — and each event lands in the day's record. Baari holds the pen so the data writes itself.",
      stat: "248",
      statLabel: "check-ins tracked this month",
      icon: CheckCircle2,
    },
    {
      eyebrow: "Walk-ins + bookings",
      title: "The mix of intent.",
      body: "Booked ahead vs walked in vs called-back — three kinds of demand, one queue, one line of measurement. See how much of your month came in planned and how much showed up cold.",
      stat: "37% / 50% / 13%",
      statLabel: "app / front desk / walk-in split",
      icon: GitMerge,
    },
    {
      eyebrow: "Late + no-show",
      title: "The failure signal.",
      body: "Anyone past their slot is automatically flagged. One tap marks them no-show — the next customer moves up. And the no-show rate quietly rolls into your reports so you can see when things start to drift, months before the vibe shifts.",
      stat: "8.1%",
      statLabel: "no-show rate, down from 11.5%",
      icon: XCircle,
    },
  ];

  return (
    <section className="container py-20 sm:py-28">
      <div className="mx-auto mb-16 max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
          The collection layer
        </div>
        <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          To measure your business, we first had to run it.
        </h2>
        <p className="mt-4 text-balance text-base text-muted-foreground sm:text-lg">
          Every check-in, mark-done, walk-in, and no-show is a signal.
          The dashboard is what all those signals add up to.
        </p>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
        {features.map((f, i) => (
          <motion.div
            key={f.eyebrow}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col rounded-2xl border border-border bg-card/60 p-7 backdrop-blur"
          >
            <div className="mb-5 grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
              <f.icon className="size-5" />
            </div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/90">
              {f.eyebrow}
            </div>
            <h3 className="mt-1 text-xl font-semibold tracking-tight">{f.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {f.body}
            </p>
            <div className="mt-6 border-t border-border/60 pt-5">
              <div className="text-3xl font-extrabold tracking-tight tabular-nums">
                {f.stat}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {f.statLabel}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
