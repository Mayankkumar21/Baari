import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Insights } from "@/components/sections/insights";
import { InMotion } from "@/components/sections/in-motion";
import { Features } from "@/components/sections/features";
import { MoreFeatures } from "@/components/sections/more-features";
import { CustomerApp } from "@/components/sections/customer-app";
import { PricingStrip } from "@/components/sections/pricing-strip";
import { CtaClosing } from "@/components/sections/cta-closing";

// Section order — deliberately answers the buyer's mental sequence:
//   1. Hero — "here's the promise (paper register does the math)"
//   2. Features — "yes, it handles the day-to-day queue"
//   3. In Motion — "here's the actual product working"
//   4. Insights — "and here's the bonus payoff you didn't know you
//                  needed — silent churn, cohort retention, etc."
//   5. Pricing strip — "here's what it costs"
//   6. Customer app — "your customers get an app too"
//   7. CTA closer — "start free"
//
// The queue-first ordering answers "does this even work?" before
// pitching analytics, which is what the co-founder review flagged
// as the missing beat. Insights is still visually elevated (indigo
// backdrop + huge numbers) — it just doesn't have to carry the
// "is this legit?" question.
export default function HomePage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <Hero />
      <section id="how-it-works">
        <HowItWorks />
      </section>
      <section id="features">
        <Features />
      </section>
      <section id="demo">
        <InMotion />
      </section>
      <section id="insights">
        <Insights />
      </section>
      <MoreFeatures />
      <section id="pricing">
        <PricingStrip />
      </section>
      <CustomerApp />
      <CtaClosing />
      <SiteFooter />
    </main>
  );
}
