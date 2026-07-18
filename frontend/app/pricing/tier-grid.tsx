"use client";

// Auto-detected pricing display.
//
// Two tiers exist economically: India (INR) and everyone-else (USD).
// India historically pays less for SaaS than global markets, so we
// price accordingly — and we detect the visitor's region rather than
// offer a picker so people don't just tick "India" to save money.
//
// SSR renders USD (the safer default for global reach). Client-side
// mount checks `Intl.Locale.region` / navigator.language; if the
// visitor is in India, the display swaps to INR after hydration. Same
// signup flow either way — this is a display concern, not a billing
// one.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { detectRegion, type Region } from "@/lib/region";
import { InterestButton } from "./interest-modal";

const PRICES = {
  IN:     { symbol: "₹",  free: "₹0",  growth: "₹999",  pro: "₹1,999", label: "India (₹)",  flag: "🇮🇳" },
  GLOBAL: { symbol: "$",  free: "$0",  growth: "$19",   pro: "$49",    label: "USD",         flag: "🌐" },
} as const;

const FEATURES = {
  free: [
    "Up to 100 completed customers / month",
    "Live receptionist queue + walk-ins",
    "Family + guest bookings",
    "Missed-call → SMS booking link",
    "Basic reports (customers, no-shows, peak hours)",
    "Revenue tracking (optional)",
    "1 doctor / stylist",
  ],
  growth: [
    "Up to 500 completed customers / month",
    "Everything in Free, plus:",
    "Customer app bookings on",
    "Up to 3 doctors / stylists",
    "Returning-customer chip on the queue",
    "New vs returning + silent-churn reports",
    "Category revenue split",
    "Direct WhatsApp support from founders",
  ],
  pro: [
    "Unlimited completed customers",
    "Everything in Growth, plus:",
    "Unlimited doctors / stylists",
    "Cohort retention charts",
    "Customer lifetime value chips",
    "Self-serve data export (CSV)",
    "Priority support (< 4 hour response)",
  ],
};

export function TierGrid({
  authedContext,
}: {
  authedContext: { defaultEmail: string; defaultMobile: string } | null;
}) {
  // SSR-safe default = global USD; India visitors get flipped on
  // hydration. Avoids a layout jump when the price string length
  // changes marginally — Growth/Pro widths differ by ~1 char.
  const [region, setRegion] = useState<Region>("GLOBAL");
  useEffect(() => {
    setRegion(detectRegion());
  }, []);

  const money = PRICES[region];

  return (
    <>
      <div className="mx-auto mb-6 flex max-w-6xl justify-end">
        <span
          title="Prices adjust to your region automatically."
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] text-muted-foreground"
        >
          <span>{money.flag}</span>
          <span>Showing prices in {money.label}</span>
        </span>
      </div>
      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
        <TierCard
          name="Free"
          price={money.free}
          per="/ month, forever"
          tagline="Today's numbers. Perfect for small clinics + pilot users."
          cta="Start free"
          features={FEATURES.free}
          // Free tier has no interest-capture flow — you can just use
          // it. Authed visitors already ARE on Free (or higher), so
          // they get a "You're already in" ghost note instead.
          authedFooter={
            authedContext ? (
              <div className="w-full text-center text-xs text-muted-foreground">
                You&apos;re already signed in.
              </div>
            ) : null
          }
        />
        <TierCard
          name="Growth"
          price={money.growth}
          per="/ month"
          tagline="Patterns in your data. For the busy clinic or salon."
          highlight
          badge="Most popular"
          cta="Try free for 2 months"
          features={FEATURES.growth}
          authedFooter={
            authedContext ? (
              <InterestButton
                desiredPlan="growth"
                planLabel="Growth"
                buttonLabel="I want Growth"
                region={region}
                defaultEmail={authedContext.defaultEmail}
                defaultMobile={authedContext.defaultMobile}
                variant="glow"
              />
            ) : null
          }
        />
        <TierCard
          name="Pro"
          price={money.pro}
          per="/ month"
          tagline="The long view. For multi-doctor practices + high-volume salons."
          cta="Try free for 2 months"
          features={FEATURES.pro}
          authedFooter={
            authedContext ? (
              <InterestButton
                desiredPlan="pro"
                planLabel="Pro"
                buttonLabel="I want Pro"
                region={region}
                defaultEmail={authedContext.defaultEmail}
                defaultMobile={authedContext.defaultMobile}
              />
            ) : null
          }
        />
      </div>
    </>
  );
}

function TierCard({
  name,
  price,
  per,
  tagline,
  features,
  cta,
  highlight = false,
  badge,
  authedFooter,
}: {
  name: string;
  price: string;
  per: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  badge?: string;
  // When the visitor is signed in, we render this instead of the
  // "Try free for 2 months → /signup" CTA. Interest-capture button
  // for Growth/Pro; "You're already signed in" note for Free.
  authedFooter?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-6 sm:p-7",
        highlight
          ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10 ring-1 ring-primary/20"
          : "border-border bg-card/60",
      )}
    >
      {badge ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground shadow-md">
          {badge}
        </div>
      ) : null}
      <div className="mb-1 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {name}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold tracking-tight">{price}</span>
        <span className="text-sm text-muted-foreground">{per}</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{tagline}</p>

      <ul className="mt-6 space-y-2.5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <div className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
              <Check className="size-3" />
            </div>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 pt-2">
        {authedFooter ? (
          authedFooter
        ) : (
          <Button
            asChild
            size="lg"
            variant={highlight ? "glow" : "outline"}
            className="w-full"
          >
            <Link href="/signup">
              {cta} <ArrowRight className="size-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
