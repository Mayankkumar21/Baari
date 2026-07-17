// Pricing page. Structured to answer three questions in order:
// 1. What does it cost me RIGHT NOW? (free — 2 months of Baari Pro)
// 2. What will it cost after? (3 clean tiers, no gotchas)
// 3. Why should I trust you not to change the deal later?
//    (written promises: no paid ranking, no lock-in, 30-day notice)

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Check,
  Clock,
  Download,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getSession } from "@/lib/session";
import { TierGrid } from "./tier-grid";

export default async function PricingPage() {
  // Peek at the session so authed owners see "I want this plan"
  // (which opens the interest-capture modal) instead of the
  // "Start free / Try free for 2 months" CTAs that dead-end at
  // /signup or /queue.
  const sess = await getSession();
  const authedContext = sess
    ? {
        defaultEmail: sess.user.email ?? "",
        defaultMobile: sess.user.mobile ?? "",
      }
    : null;

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
            Every new signup starts on the top plan for 60 days. Everything
            unlocked — silent churn, category revenue, cohort retention, LTV
            per customer, plus the queue and booking flow the data flows
            through. <strong className="text-foreground">No card required.</strong>
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

      {/* Tier cards — currency-aware client component. */}
      <section className="container pt-16 sm:pt-24">
        <TierGrid authedContext={authedContext} />
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
            The dashboard header carries a live countdown of your trial
            days. You decide when day 60 arrives — we don&apos;t
            auto-charge.
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
              body="We'll notify you in-app well before any charges. If you don't want to continue, one tap and your workspace stays free until you decide."
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
