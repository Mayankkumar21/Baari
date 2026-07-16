"use client";

// The "know your business" section. Sits above the operational queue
// features (Features.tsx) so the payoff shows before the plumbing.
// Three cards, each with a title (the promise), a small body (what
// the owner will see), and a bespoke mini-visualisation (list / bar
// / grid) rendered in pure JSX — no chart libs, no images.
//
// Deliberately minimal on motion + gradients. The queue Features
// section already carries the mock-UI look; this section reads more
// like data-first product marketing.

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
          Not another queue app
        </div>
        <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-[44px] md:leading-[1.1]">
          The business your paper register never showed you.
        </h2>
        <p className="mt-4 text-balance text-base text-muted-foreground sm:text-lg">
          Baari runs your day. Then it quietly turns every visit into signal —
          who&apos;s leaving, what actually pays, who&apos;s coming back. Decisions,
          not just data.
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
          title="Know what actually pays."
          body="Consultation vs pharmacy vs procedure — Baari splits every rupee by category so you can finally see which service earns the year."
          visual={<CategoryBars />}
        />
        <InsightCard
          icon={TrendingUp}
          eyebrow="Cohort retention"
          title="Watch customers come back."
          body="What share of January&apos;s new customers came back in February? In April? Catch a slip before it eats the year."
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
      className="flex flex-col rounded-2xl border border-border bg-card/60 p-6 backdrop-blur"
    >
      <div className="mb-4 grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {eyebrow}
      </div>
      <h3 className="mt-1 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      <div className="mt-5">{visual}</div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Mini-visualisations. Purely decorative — real values are pulled
   from the receptionist's own workspace on /reports.
   ───────────────────────────────────────────────────────────────────── */

function ChurnList() {
  const rows = [
    { name: "Sarah Chen", days: 78, visits: 6 },
    { name: "Amir Khan", days: 64, visits: 4 },
    { name: "Priya Sharma", days: 60, visits: 8 },
  ];
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div
          key={r.name}
          className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 text-[11px]"
        >
          <div>
            <div className="font-semibold">{r.name}</div>
            <div className="text-muted-foreground">{r.visits} visits</div>
          </div>
          <div className="tabular-nums text-muted-foreground">{r.days}d ago</div>
        </div>
      ))}
    </div>
  );
}

function CategoryBars() {
  // Rendered as a stacked bar + legend.
  const cats = [
    { name: "Consultation", pct: 52, tone: "hsl(var(--primary) / 0.85)" },
    { name: "Pharmacy",     pct: 31, tone: "hsl(var(--primary) / 0.55)" },
    { name: "Procedure",    pct: 17, tone: "hsl(var(--primary) / 0.30)" },
  ];
  return (
    <div>
      <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full bg-secondary/60">
        {cats.map((c) => (
          <div
            key={c.name}
            style={{ width: `${c.pct}%`, backgroundColor: c.tone }}
          />
        ))}
      </div>
      <ul className="space-y-1.5 text-[11px]">
        {cats.map((c) => (
          <li key={c.name} className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-sm"
                style={{ backgroundColor: c.tone }}
              />
              {c.name}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {c.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CohortHeatmap() {
  // 4 cohort rows × 4 month-offsets. Values are percentages;
  // background alpha climbs with the number.
  const cohorts = [
    { m: "Jul", size: 18, r: [100, 55, 40, 34] },
    { m: "Jun", size: 22, r: [100, 62, 44, 38] },
    { m: "May", size: 14, r: [100, 71, 50, 46] },
    { m: "Apr", size: 20, r: [100, 60, 42, 39] },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background/40">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-muted-foreground">
            <th className="px-2 py-1 text-left font-medium">Cohort</th>
            <th className="px-1 py-1 text-center font-medium">M0</th>
            <th className="px-1 py-1 text-center font-medium">M1</th>
            <th className="px-1 py-1 text-center font-medium">M2</th>
            <th className="px-1 py-1 text-center font-medium">M3</th>
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.m} className="border-t border-border/50">
              <td className="px-2 py-1 font-semibold tabular-nums">{c.m}</td>
              {c.r.map((pct, i) => (
                <td key={i} className="px-1 py-1 text-center">
                  <span
                    className="inline-flex min-w-[28px] justify-center rounded px-1 py-0.5 tabular-nums"
                    style={{
                      backgroundColor: `hsl(var(--primary) / ${Math.min(pct, 100) / 140 + 0.05})`,
                      color: pct > 55 ? "hsl(var(--primary-foreground))" : undefined,
                    }}
                  >
                    {pct}%
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
