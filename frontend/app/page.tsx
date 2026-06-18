import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/sections/hero";
import { Verticals } from "@/components/sections/verticals";
import { Features } from "@/components/sections/features";
import { CtaClosing } from "@/components/sections/cta-closing";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <Hero />
      <Verticals />
      <Features />
      <CtaClosing />
      <SiteFooter />
    </main>
  );
}
