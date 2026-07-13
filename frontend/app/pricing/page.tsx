// Pricing page. Structured to answer three questions in order:
// 1. What does it cost me RIGHT NOW? (free — 2 months of Baari Pro)
// 2. What will it cost after? (3 clean tiers, no gotchas)
// 3. Why should I trust you not to change the deal later?
//    (written promises: no paid ranking, no lock-in, 30-day notice)

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  Clock,
  Download,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function PricingPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="container pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="size-3" /> Early access
          </div>
          <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Try <span className="text-gradient">Baari Pro</span>
            <br className="hidden sm:block" /> free for 2 months.
          </h1>
          <p className="mt-6 text-balance text-lg text-muted-foreground">
            Every new signup starts on our top plan for 60 days. Everything
            unlocked — full receptionist queue, walk-in flow, analytics,
            revenue tracking, patient memory, customer app.{" "}
            <strong className="text-foreground">No card required.</strong>
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="xl" variant="glow">
              <Link href="/signup">
                Start free <ArrowRight className="size-5" />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            After 60 days, pick the plan that fits — or stay free if you&apos;re
            under 100 customers a month. Cancel any time.
          </p>
        </div>
      </section>

      {/* Tier cards */}
      <section className="container pt-16 sm:pt-24">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          <TierCard
            name="Free"
            price="₹0"
            per="/ month, forever"
            tagline="Perfect for small clinics and pilot users."
            cta="Start free"
            features={[
              "Up to 100 completed customers / month",
              "Live receptionist queue + walk-ins",
              "Family + guest bookings",
              "Basic reports (patients, no-shows, peak hours)",
              "Revenue tracking (optional)",
              "1 doctor / stylist",
            ]}
          />
          <TierCard
            name="Growth"
            price="₹999"
            per="/ month"
            tagline="For the busy salon or clinic. Everything unlocked."
            highlight
            badge="Most popular"
            cta="Try free for 2 months"
            features={[
              "Up to 500 completed customers / month",
              "Everything in Free, plus:",
              "Customer app bookings on",
              "Silent-churn list — regulars who stopped coming",
              "New vs repeat customer breakdown",
              "Category revenue (consultation, pharmacy, products)",
              "Daily EOD summary on WhatsApp",
              "Templated broadcasts (20 / month)",
              "Direct WhatsApp support from founders",
            ]}
          />
          <TierCard
            name="Pro"
            price="₹1,999"
            per="/ month"
            tagline="For multi-doctor practices and high-volume salons."
            cta="Try free for 2 months"
            features={[
              "Unlimited completed customers",
              "Everything in Growth, plus:",
              "Up to 5 doctors / stylists",
              "Cohort retention charts",
              "Customer lifetime value analytics",
              "Referral tracking with rewards",
              "Unlimited broadcasts",
              "Self-serve data export (CSV)",
              "API access for your integrations",
              "Priority support (< 4 hour response)",
            ]}
          />
        </div>
      </section>

      {/* The 2-month deal — explicit */}
      <section className="container pt-20 sm:pt-28">
        <div className="mx-auto max-w-3xl rounded-2xl border border-primary/25 bg-primary/5 p-8 sm:p-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="size-3" /> The offer
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            Two months of Baari Pro. On us.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            We know queue software is a leap of faith when you&apos;ve been
            running on paper and phone calls. So here&apos;s the deal:{" "}
            <strong className="text-foreground">
              every new signup gets 60 days of Baari Pro — the top plan — free.
            </strong>{" "}
            No card, no strings.
          </p>
          <p className="mt-3 text-base text-muted-foreground">
            After 60 days, you&apos;ll have real data about your own business.
            Pick a plan that fits, downgrade to Free if you&apos;re small, or
            walk away with your data intact. Whatever makes sense.
          </p>
          <p className="mt-3 text-base text-muted-foreground">
            We&apos;ll email + WhatsApp you before day 60. You decide, we
            don&apos;t auto-charge.
          </p>
        </div>
      </section>

      {/* Trust promises */}
      <section className="container pt-20 sm:pt-28 pb-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            What we promise, in writing.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <PromiseCard
              icon={<ShieldCheck className="size-5" />}
              title="No paid ranking. Ever."
              body="Businesses on the Baari app are ranked by distance, rating, and response time. We don't sell placement. If we ever change this policy, you get 30 days notice."
            />
            <PromiseCard
              icon={<Download className="size-5" />}
              title="No lock-in. Export any time."
              body="Your patient list, booking history, and revenue reports are yours. Cancel any time. We keep your data 30 days for recovery, then delete it on request."
            />
            <PromiseCard
              icon={<Clock className="size-5" />}
              title="30-day billing notice."
              body="We'll email and WhatsApp before any charges. If you don't want to continue, one tap and your workspace stays free until you decide."
            />
            <PromiseCard
              icon={<Check className="size-5" />}
              title="No hidden tiers."
              body="Everything on this page is what you get on the trial. When you pick a plan, the same features stay — nothing gets paywalled retroactively."
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container pb-24">
        <div className="mx-auto max-w-2xl rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center sm:p-12">
          <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            Try it while it&apos;s free.
          </h2>
          <p className="mt-3 text-balance text-muted-foreground">
            Signup takes about 5 minutes. Your first walk-in can go in today.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="xl" variant="glow">
              <Link href="/signup">
                Start free <ArrowRight className="size-5" />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link href="https://wa.me/919893127527">WhatsApp us</Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

// A single tier card. `highlight` swaps the border and background for the
// Growth plan since that's the intended "most people" SKU — the visual
// hierarchy nudges without lying about the other tiers being available.
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
          <Link href="/signup">{cta}</Link>
        </Button>
      </div>
    </div>
  );
}

function PromiseCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5">
      <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="text-base font-semibold">{title}</div>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
