"use client";

// The "know your business" hero moment. Deliberately treated as the
// centerpiece of the landing — subtle indigo wash so the eye stops
// here, cards blown up with one huge number each. Everything else
// on the page can look uniform; this section can't.

import { motion } from "motion/react";
import { PieChart, TrendingUp, UserMinus } from "lucide-react";

export function Insights() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      {/* Distinctive background — a very soft indigo wash + orbs so
          the section literally looks different from its neighbours.
          Kept subtle enough that it doesn't fight the accent
          treatment on the CTA closer at the bottom of the page. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.05] via-primary/[0.02] to-transparent" />
      <div className="orb pointer-events-none absolute left-[8%] top-[12%] h-[420px] w-[420px] bg-primary/20" />
      <div className="orb pointer-events-none absolute right-[6%] bottom-[10%] h-[380px] w-[380px] bg-primary/15" />

      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            The Signal
          </div>
          <h2 className="mt-6 text-balance text-4xl font-extrabold tracking-tight sm:text-5xl md:text-[56px] md:leading-[1.05]">
            The business your paper register never counted.
          </h2>
          <p className="mt-6 text-balance text-lg text-muted-foreground sm:text-xl">
            Every visit a data point. Every no-show a signal. Every rupee
            logged. Three answers you couldn&apos;t buy before.
          </p>
        </motion.div>

        <div className="mx-auto mt-20 grid max-w-6xl gap-8 md:grid-cols-3">
          <InsightCard
            icon={UserMinus}
            eyebrow="Silent churn"
            stat="42"
            statSuffix=""
            statCaption="regulars stopped coming this quarter"
            body="One list, one WhatsApp, and they walk in again."
            hint="Sarah Chen · 78 days silent · 6 past visits"
          />
          <InsightCard
            icon={PieChart}
            eyebrow="Category revenue"
            stat="₹74,152"
            statSuffix=""
            statCaption="came from consultations this month"
            body="Baari splits every rupee by category so you finally know what pays the year."
            hint="+ ₹44,206 pharmacy · ₹24,242 procedure"
          />
          <InsightCard
            icon={TrendingUp}
            eyebrow="Cohort retention"
            stat="57%"
            statSuffix=""
            statCaption="of March's new customers came back in April"
            body="See which month's cohort is sticking — and catch the slip before it eats the year."
            hint="of 22 new customers in Mar &#39;26"
          />
        </div>
      </div>
    </section>
  );
}

function InsightCard({
  icon: Icon,
  eyebrow,
  stat,
  statSuffix,
  statCaption,
  body,
  hint,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  eyebrow: string;
  stat: string;
  statSuffix: string;
  statCaption: string;
  body: string;
  hint: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex flex-col rounded-3xl border border-border/60 bg-card/70 p-8 backdrop-blur-xl sm:p-10"
    >
      {/* Subtle top-edge highlight — same trick as the KPI cards on
          /reports. Makes each card feel like a distinct panel. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="mb-6 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-primary/12 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {eyebrow}
        </div>
      </div>

      {/* The moment. Everything else on the card is dressing.
          Capped at text-7xl (was 8xl) so multi-character values like
          "₹74,152" don't overflow the 3-col grid on desktop. Adds
          whitespace-nowrap + a small font-size adaptive class for the
          currency stat which is naturally 7 characters. */}
      <div className="flex items-baseline gap-1 whitespace-nowrap">
        <span
          className={
            "font-black tracking-tight tabular-nums leading-none " +
            // Two-tier ramp: short stats ("42", "57%") get to be
            // massive; long ones ("₹74,152") cap at text-6xl on
            // desktop so they still fit inside the card. Guided by
            // character count so we don't have to hardcode per-card.
            (stat.length >= 6
              ? "text-5xl sm:text-6xl"
              : "text-6xl sm:text-7xl")
          }
        >
          {stat}
        </span>
        {statSuffix ? (
          <span className="text-3xl font-extrabold text-muted-foreground/80 sm:text-4xl">
            {statSuffix}
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-balance text-base font-medium text-foreground/80 sm:text-lg">
        {statCaption}
      </div>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
        {body}
      </p>

      <div
        className="mt-6 border-t border-border/50 pt-4 text-xs tabular-nums text-muted-foreground/80"
        dangerouslySetInnerHTML={{ __html: hint }}
      />
    </motion.div>
  );
}
