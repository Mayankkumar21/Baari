import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 bg-card/30">
      <div className="container py-12">
        <div className="grid gap-10 sm:grid-cols-3">
          <FooterColumn title="Product">
            <FooterLink href="#how-it-works">How it works</FooterLink>
            <FooterLink href="#features">Features</FooterLink>
            <FooterLink href="/pricing">Pricing</FooterLink>
          </FooterColumn>

          <FooterColumn title="Company">
            <FooterLink href="mailto:hello@getbaari.in">Contact</FooterLink>
            <FooterLink href="/legal/privacy">Privacy</FooterLink>
            <FooterLink href="/legal/terms">Terms</FooterLink>
          </FooterColumn>

          <FooterColumn title="Stay in touch">
            <FooterLink href="https://wa.me/919893127527">
              WhatsApp us — +91 98931 27527
            </FooterLink>
            <FooterLink href="mailto:hello@getbaari.in">hello@getbaari.in</FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground sm:flex-row">
          <div>Built for the front desks of the world.</div>
          <div>© 2026 Baari</div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </div>
      <ul className="space-y-2 text-sm">
        {Array.isArray(children)
          ? children.map((c, i) => <li key={i}>{c}</li>)
          : <li>{children}</li>}
      </ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const external = href.startsWith("http") || href.startsWith("mailto:");
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </Link>
  );
}
