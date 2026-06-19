import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/sections/hero";
import { Verticals } from "@/components/sections/verticals";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Features } from "@/components/sections/features";
import { MoreFeatures } from "@/components/sections/more-features";
import { CtaClosing } from "@/components/sections/cta-closing";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <Hero />
      <Verticals />
      <section id="how-it-works">
        <HowItWorks />
      </section>
      <section id="features">
        <Features />
      </section>
      <MoreFeatures />
      <CtaClosing />
      <SiteFooter />
    </main>
  );
}
