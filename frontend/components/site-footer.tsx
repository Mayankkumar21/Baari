import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 bg-card/30">
      <div className="container py-12">
        <div className="grid gap-10 sm:grid-cols-3">
          <FooterColumn title="Product">
            <FooterLink href="#how-it-works">How it works</FooterLink>
            <FooterLink href="#features">Features</FooterLink>
            <span className="text-xs text-muted-foreground/70">
              Pricing — coming soon
            </span>
          </FooterColumn>

          <FooterColumn title="Company">
            <FooterLink href="#">About</FooterLink>
            <FooterLink href="mailto:hello@baari.in">Contact</FooterLink>
            <FooterLink href="#">Privacy</FooterLink>
            <FooterLink href="#">DPDP compliance</FooterLink>
          </FooterColumn>

          <FooterColumn title="Stay in touch">
            <FooterLink href="https://wa.me/919999999999">
              WhatsApp us — +91 99999 99999
            </FooterLink>
            <FooterLink href="mailto:hello@baari.in">hello@baari.in</FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground sm:flex-row">
          <div>Built in India for the front desks of India. 🇮🇳</div>
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
