// Shared shell for legal pages — Privacy + Terms + anything future.
// Uses the same header + footer as the marketing pages so users can
// navigate back without a browser back-button hunt.
//
// Hand-rolled typography instead of @tailwindcss/typography — pulls no
// extra dep into the bundle and lets us tune spacing/weights to match
// the rest of the marketing site's aesthetic.

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="container py-16 sm:py-20">
        <article
          className="
            mx-auto max-w-2xl text-[15px] leading-relaxed text-foreground/90
            [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:text-foreground
            [&_h1]:sm:text-4xl
            [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground
            [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground
            [&_p]:mb-4
            [&_ul]:mb-4 [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:marker:text-muted-foreground
            [&_ol]:mb-4 [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ol]:list-decimal
            [&_li]:pl-1
            [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-primary/80
            [&_strong]:font-semibold [&_strong]:text-foreground
            [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:font-mono
          "
        >
          {children}
        </article>
      </div>
      <SiteFooter />
    </main>
  );
}
