"use client";

// The "know your business" section. Three cards, each with a big
// number as the hero, a title, a paragraph, and a small supporting
// visual. Simplified from the earlier version — the mini-tables and
// full heatmap were noise at 3-col width; the single-stat treatment
// reads at a glance while scrolling.

import { motion } from "motion/react";
import { PieChart, UserMinus, TrendingUp } from "lucide-react";

export function Insights() {
  return (
    <section className="container py-20 sm:py-28">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-3xl text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          The signal
        </div>
        <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-[44px] md:leading-[1.1]">
          The business your paper register never counted.
        </h2>
        <p className="mt-4 text-balance text-base text-muted-foreground sm:text-lg">
          Every visit a data point. Every no-show a signal. Every rupee logged.
          Baari counts what your register couldn&apos;t — and hands you three
          answers you couldn&apos;t buy before.
        </p>
      </motion.div>

      <div className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-3">
        <InsightCard
          icon={UserMinus}
          eyebrow="Silent churn"
          title="See who ghosted."
          body="Regulars who used to come every month, gone silent for 60+ days. Baari makes the list. You send one WhatsApp."
          visual={<ChurnList />}
        />
        <InsightCard
          icon={PieChart}
          eyebrow="Category revenue"
          title="Know what pays."
          body="Consultation vs pharmacy vs procedure — Baari splits every rupee by category so you can finally see which service earns the year."
          visual={<CategoryBars />}
        />
        <InsightCard
          icon={TrendingUp}
          eyebrow="Cohort retention"
          title="Watch them return."
          body="What share of January's new customers came back in February? In April? Catch a slip before it eats the year."
          visual={<CohortHeatmap />}
        />
      </div>
    </section>
  );
}

function InsightCard({
  icon: Icon,
  eyebrow,
  title,
  body,
  visual,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  eyebrow: string;
  title: string;
  body: string;
  visual: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col rounded-2xl border border-border bg-card/60 p-7 backdrop-blur"
    >
      <div className="mb-5 grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {eyebrow}
      </div>
      <h3 className="mt-1 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      <div className="mt-6">{visual}</div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Supporting visuals — each is one big number + one supporting line.
   The mini-tables and 4×4 heatmap from the previous version competed
   with the card body for attention at 3-col width; these read at a
   glance.
   ───────────────────────────────────────────────────────────────────── */

function ChurnList() {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Regulars gone quiet
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-extrabold tracking-tight tabular-nums">
          42
        </span>
        <span className="text-xs text-muted-foreground">this quarter</span>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-md border border-border/60 bg-card/40 px-3 py-2 text-[11px]">
        <div>
          <div className="font-semibold">Sarah Chen</div>
          <div className="text-muted-foreground">6 past visits</div>
        </div>
        <div className="tabular-nums text-muted-foreground">78d ago</div>
      </div>
    </div>
  );
}

function CategoryBars() {
  const cats = [
    { name: "Consultation", pct: 52, tone: "hsl(var(--primary) / 0.85)" },
    { name: "Pharmacy", pct: 31, tone: "hsl(var(--primary) / 0.55)" },
    { name: "Procedure", pct: 17, tone: "hsl(var(--primary) / 0.30)" },
  ];
  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        This month
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-extrabold tracking-tight tabular-nums">
          ₹74,152
        </span>
        <span className="text-xs text-muted-foreground">from consultations</span>
      </div>
      <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-secondary/60">
        {cats.map((c) => (
          <div
            key={c.name}
            title={`${c.name} · ${c.pct}%`}
            style={{ width: `${c.pct}%`, backgroundColor: c.tone }}
          />
        ))}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        + ₹44,206 pharmacy · ₹24,242 procedure
      </div>
    </div>
  );
}

function CohortHeatmap() {
  const trail = [100, 55, 40, 34]; // one cohort, 4-month return %s
  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Mar &apos;26 cohort · returned in Apr
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-extrabold tracking-tight tabular-nums">
          57%
        </span>
        <span className="text-xs text-muted-foreground">of 22 new customers</span>
      </div>
      <div className="mt-4 flex items-center gap-1.5">
        {trail.map((pct, i) => (
          <span
            key={i}
            className="inline-flex flex-1 justify-center rounded px-1.5 py-1.5 text-[11px] font-semibold tabular-nums"
            style={{
              backgroundColor: `hsl(var(--primary) / ${Math.min(pct, 100) / 130 + 0.06})`,
              color: pct > 55 ? "hsl(var(--primary-foreground))" : undefined,
            }}
          >
            {pct}%
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="flex-1 text-center">M0</span>
        <span className="flex-1 text-center">M1</span>
        <span className="flex-1 text-center">M2</span>
        <span className="flex-1 text-center">M3</span>
      </div>
    </div>
  );
}
