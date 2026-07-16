import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/sections/hero";
import { Verticals } from "@/components/sections/verticals";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Insights } from "@/components/sections/insights";
import { Features } from "@/components/sections/features";
import { MoreFeatures } from "@/components/sections/more-features";
import { CustomerApp } from "@/components/sections/customer-app";
import { CtaClosing } from "@/components/sections/cta-closing";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <Hero />
      <Verticals />
      {/* Insights lands before HowItWorks + Features on purpose —
          the "know your business" payoff shows first, then the
          operational plumbing that makes it possible. */}
      <section id="insights">
        <Insights />
      </section>
      <section id="how-it-works">
        <HowItWorks />
      </section>
      <section id="features">
        <Features />
      </section>
      <MoreFeatures />
      <CustomerApp />
      <CtaClosing />
      <SiteFooter />
    </main>
  );
}
