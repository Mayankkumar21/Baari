// Shared shell for legal pages — Privacy + Terms + anything future.
// Uses the same header + footer as the marketing pages so users can
// navigate back without a browser back-button hunt.

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <article className="container prose prose-sm prose-slate dark:prose-invert max-w-3xl py-16 sm:py-20">
        {children}
      </article>
      <SiteFooter />
    </main>
  );
}
