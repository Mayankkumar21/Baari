"use client";

// Compact "here's what it costs" strip that sits BELOW the payoff
// sections and ABOVE the CTA closer. The visitor has been sold on the
// product by now; this is the price gate — visible on the landing so
// they don't have to click through to /pricing to check.
//
// Indian owners specifically look for a number before they'll commit
// even to a free trial. Prices are region-detected client-side (INR
// for India visitors, USD for everyone else) matching the /pricing
// page treatment so nobody sees a different number in two places.
//
// Deliberately not a duplicate of the /pricing tier grid — no feature
// lists, no CTAs per tier. Just the numbers and the caps. Curious
// visitors follow the "See full plans" link to /pricing.

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { detectRegion, type Region } from "@/lib/region";

const PRICES = {
  IN: {
    free: "₹0",
    growth: "₹999",
    pro: "₹1,999",
    per: "/ month",
    footer: "All prices in INR. Cancel any time. Downgrade to Free instead of losing your workspace.",
  },
  GLOBAL: {
    free: "$0",
    growth: "$19",
    pro: "$49",
    per: "/ month",
    footer: "All prices in USD. Cancel any time. Downgrade to Free instead of losing your workspace.",
  },
} as const;

export function PricingStrip() {
  // SSR-safe start: USD default, swap to INR after mount if the
  // visitor reads as Indian. Same pattern used on /pricing.
  const [region, setRegion] = useState<Region>("GLOBAL");
  useEffect(() => {
    setRegion(detectRegion());
  }, []);
  const money = PRICES[region];

  return (
    <section className="container py-20 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-3xl text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
          After the trial
        </div>
        <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Three prices. No surprises.
        </h2>
        <p className="mt-4 text-balance text-base text-muted-foreground sm:text-lg">
          Every new signup starts on 60 days of Pro. When the trial ends,
          pick the plan that fits — or stay Free.
        </p>
      </motion.div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-3 sm:gap-5">
        <TierRow
          name="Free"
          price={money.free}
          per="/ month, forever"
          cap="Up to 100 completed customers / month"
        />
        <TierRow
          name="Growth"
          price={money.growth}
          per={money.per}
          cap="Up to 500 completed customers / month"
          highlight
        />
        <TierRow
          name="Pro"
          price={money.pro}
          per={money.per}
          cap="Unlimited completed customers"
        />
      </div>

      <div className="mx-auto mt-8 max-w-3xl text-center">
        <p className="text-sm text-muted-foreground">{money.footer}</p>
        <Link
          href="/pricing"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          See full plans and features
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

function TierRow({
  name,
  price,
  per,
  cap,
  highlight = false,
}: {
  name: string;
  price: string;
  per: string;
  cap: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "relative rounded-xl border p-6 backdrop-blur " +
        (highlight
          ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10"
          : "border-border bg-card/60")
      }
    >
      {highlight ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground shadow-md">
          Most popular
        </div>
      ) : null}
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/90">
        {name}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold tracking-tight tabular-nums">
          {price}
        </span>
        <span className="text-sm text-muted-foreground">{per}</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{cap}</p>
    </div>
  );
}
