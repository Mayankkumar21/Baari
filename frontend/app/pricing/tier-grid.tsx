"use client";

// Client-side currency selector + tier cards. Detects a sensible
// default from navigator.language / Intl.Locale on mount, then lets
// the visitor override via a small dropdown. Prices are hardcoded
// round-numbers per currency — the point is display sanity for
// international trialists, not a live forex feed. Growth/Pro numbers
// are close-to-market equivalents rounded to friendly-looking prices.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CurrencyCode = "INR" | "USD" | "GBP" | "EUR" | "SGD" | "AED" | "AUD" | "CAD";

type Money = { symbol: string; free: string; growth: string; pro: string; per: string };

const CURRENCIES: Record<CurrencyCode, Money & { label: string; flag: string }> = {
  INR: { label: "India (₹)",           flag: "🇮🇳", symbol: "₹",   free: "₹0",    growth: "₹999",   pro: "₹1,999",  per: "/ month" },
  USD: { label: "United States ($)",   flag: "🇺🇸", symbol: "$",   free: "$0",    growth: "$14",    pro: "$29",     per: "/ month" },
  GBP: { label: "United Kingdom (£)",  flag: "🇬🇧", symbol: "£",   free: "£0",    growth: "£11",    pro: "£22",     per: "/ month" },
  EUR: { label: "Europe (€)",          flag: "🇪🇺", symbol: "€",   free: "€0",    growth: "€13",    pro: "€26",     per: "/ month" },
  SGD: { label: "Singapore (S$)",      flag: "🇸🇬", symbol: "S$",  free: "S$0",   growth: "S$18",   pro: "S$36",    per: "/ month" },
  AED: { label: "UAE (AED)",           flag: "🇦🇪", symbol: "AED", free: "AED 0", growth: "AED 49", pro: "AED 99",  per: "/ month" },
  AUD: { label: "Australia (A$)",      flag: "🇦🇺", symbol: "A$",  free: "A$0",   growth: "A$19",   pro: "A$39",    per: "/ month" },
  CAD: { label: "Canada (C$)",         flag: "🇨🇦", symbol: "C$",  free: "C$0",   growth: "C$19",   pro: "C$39",    per: "/ month" },
};

// Country → currency mapping for the initial guess. Everything not
// listed here falls back to USD — that's more universal than INR for
// a first-time global visitor.
const REGION_MAP: Record<string, CurrencyCode> = {
  IN: "INR",
  US: "USD", CA: "CAD", MX: "USD",
  GB: "GBP",
  SG: "SGD", MY: "SGD",
  AE: "AED", SA: "AED", QA: "AED",
  AU: "AUD", NZ: "AUD",
  // EU-ish. Not exhaustive; anything else falls to USD.
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR", IE: "EUR",
  AT: "EUR", PT: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", SK: "EUR", SI: "EUR",
};

function guessCurrency(): CurrencyCode {
  if (typeof navigator === "undefined") return "USD";
  try {
    const loc = new Intl.Locale(navigator.language);
    const region = (loc as unknown as { region?: string }).region ?? "";
    if (region && REGION_MAP[region]) return REGION_MAP[region];
    // Language-only hint fallback (en-IN often lacks region on some
    // browsers).
    const tag = navigator.language.toLowerCase();
    if (tag.endsWith("-in") || tag === "hi") return "INR";
    if (tag.endsWith("-gb")) return "GBP";
    if (tag.endsWith("-au")) return "AUD";
    if (tag.endsWith("-sg")) return "SGD";
  } catch {
    // ignore
  }
  return "USD";
}

const CURRENCY_STORAGE_KEY = "baari_pricing_currency";

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

export function TierGrid() {
  const [currency, setCurrency] = useState<CurrencyCode>("INR");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Load saved choice first, else auto-detect. SSR paint always
    // shows INR to avoid layout shift when JS is disabled.
    try {
      const saved = localStorage.getItem(CURRENCY_STORAGE_KEY) as CurrencyCode | null;
      if (saved && CURRENCIES[saved]) {
        setCurrency(saved);
      } else {
        setCurrency(guessCurrency());
      }
    } catch {
      setCurrency(guessCurrency());
    }
    setReady(true);
  }, []);

  const change = (c: CurrencyCode) => {
    setCurrency(c);
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, c);
    } catch {
      // no-op
    }
  };

  const money = CURRENCIES[currency];

  return (
    <>
      <div className="mx-auto mb-6 flex max-w-6xl justify-end">
        <CurrencyPicker current={currency} onChange={change} ready={ready} />
      </div>
      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
        <TierCard
          name="Free"
          price={money.free}
          per="/ month, forever"
          tagline="Perfect for small clinics and pilot users."
          cta="Start free"
          features={FEATURES.free}
        />
        <TierCard
          name="Growth"
          price={money.growth}
          per={money.per}
          tagline="For the busy salon or clinic."
          highlight
          badge="Most popular"
          cta="Try free for 2 months"
          features={FEATURES.growth}
        />
        <TierCard
          name="Pro"
          price={money.pro}
          per={money.per}
          tagline="For multi-doctor practices and high-volume salons."
          cta="Try free for 2 months"
          features={FEATURES.pro}
        />
      </div>
    </>
  );
}

function CurrencyPicker({
  current,
  onChange,
  ready,
}: {
  current: CurrencyCode;
  onChange: (c: CurrencyCode) => void;
  ready: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = useMemo(() => CURRENCIES[current], [current]);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium hover:border-primary/40"
      >
        <span>{label.flag}</span>
        <span>{label.label}</span>
        <ChevronDown className="size-3 opacity-60" />
        {!ready ? <span className="ml-1 text-[10px] opacity-60">(default)</span> : null}
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-card/95 shadow-xl backdrop-blur"
          onMouseLeave={() => setOpen(false)}
        >
          {(Object.entries(CURRENCIES) as [CurrencyCode, (typeof CURRENCIES)[CurrencyCode]][]).map(
            ([code, c]) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  onChange(code);
                  setOpen(false);
                }}
                className={
                  "flex w-full items-center gap-2 border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 hover:bg-secondary/60 " +
                  (code === current ? "bg-primary/10 font-semibold" : "")
                }
              >
                <span>{c.flag}</span>
                <span className="flex-1">{c.label}</span>
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
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
}: {
  name: string;
  price: string;
  per: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  badge?: string;
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
      </div>
    </div>
  );
}
