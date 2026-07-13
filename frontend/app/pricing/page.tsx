// Pricing — a "coming soon" surface that still doubles as a trust
// document. Owners judge SaaS by three things: what it costs today,
// what it'll cost tomorrow, and whether they can leave when they
// want. This page answers all three honestly rather than hiding the
// ball behind a "contact sales" wall.

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
            Baari is <span className="text-gradient">free right now.</span>
          </h1>
          <p className="mt-6 text-balance text-lg text-muted-foreground">
            Every new signup gets a <strong className="text-foreground">2-month free trial</strong>{" "}
            with the full product — the receptionist queue, walk-in flow,
            reports, revenue tracking, patient memory, and the customer app.
            No card required.
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
        </div>
      </section>

      {/* What's included */}
      <section className="container pt-20 sm:pt-28">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            What you get, for free.
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            No feature flags. No paywalled tier. The tool is the tool.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {INCLUDED.map((f) => (
              <div
                key={f}
                className="flex items-start gap-3 rounded-lg border border-border bg-card/60 p-4"
              >
                <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                  <Check className="size-3.5" />
                </div>
                <div className="text-sm">{f}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* After the trial */}
      <section className="container pt-20 sm:pt-28">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card/60 p-8 sm:p-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Clock className="size-3" /> Later
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            After the trial — pricing coming soon.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            We&apos;re still learning what fair looks like for a Tier-2 salon
            or clinic. When we&apos;re ready, our pricing will be simple,
            transparent, and priced for pilot-stage owners — not enterprise
            catalogs.
          </p>
          <p className="mt-3 text-base text-muted-foreground">
            We&apos;ll never surprise you with a bill. Every user on the free
            trial will get <strong className="text-foreground">at least 30 days notice</strong>{" "}
            before any charges begin, with the choice to keep going or export
            everything and walk away.
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
              body="Every feature on this page is free on the trial. When paid pricing arrives, the same features will be in the base plan — nothing gets paywalled retroactively."
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
              <Link href="https://wa.me/919893127527">
                WhatsApp us
              </Link>
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

const INCLUDED = [
  "Live queue with real-time counters — waiting, in-session, done, running late",
  "Walk-ins added in two taps — name, mobile, done",
  "Family group bookings — one token for everyone coming together",
  "Automatic no-show flagging + one-tap restore if they walk in later",
  "Patient memory — 5th visit · last Nov 3, shown on every queue row",
  "Optional revenue tracking — type the amount at Mark done",
  "Reports — daily / weekly / monthly, by service, by source, by hour",
  "Customer app — clinics/salons can accept online bookings if they want",
  "Multi-doctor / multi-stylist support (opt-in)",
  "Rate-limited APIs and DB-level slot uniqueness — no double-booking",
  "Hindi + English customer-facing screens",
  "Full data export — patients, bookings, revenue, all yours",
];
