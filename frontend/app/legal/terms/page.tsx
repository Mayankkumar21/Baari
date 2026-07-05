import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms — Baari",
  description:
    "Terms of service for using Baari's queue and appointment management platform.",
};

const LAST_UPDATED = "5 July 2026";

export default function TermsPage() {
  return (
    <>
      <div className="mb-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Legal · Terms
      </div>
      <h1>Terms of Service</h1>
      <div className="mt-4 mb-10 flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3.5 py-2 text-[13px] text-muted-foreground">
        <span className="font-semibold text-foreground">Last updated</span>
        <span>·</span>
        <span>{LAST_UPDATED}</span>
        <span>·</span>
        <a href="/legal/privacy" className="hover:text-foreground">Privacy →</a>
      </div>

      <p className="text-lg leading-relaxed text-foreground/95">
        By creating an account, using the Baari dashboard, using the mobile
        app, or booking through a Baari-powered flow, you agree to these
        Terms.
      </p>

      <h2>1. The service</h2>
      <p>
        Baari is a software platform that helps local businesses manage
        appointment queues, walk-ins, and family bookings. Customers can
        discover and book at participating businesses through the Baari
        mobile app or via a link they receive after calling or visiting the
        business.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You&apos;re responsible for keeping your password confidential.</li>
        <li>You&apos;re responsible for activity that happens under your account.</li>
        <li>Tell us immediately if you suspect your account has been compromised.</li>
        <li>Baari accounts are for legitimate business use only. Bots, spam, and impersonation are prohibited.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the service to send unsolicited messages or spam.</li>
        <li>Use the service to impersonate another business or person.</li>
        <li>Attempt to interfere with, reverse-engineer, or gain unauthorised access to any part of Baari.</li>
        <li>Scrape, mine, or bulk-download data from the platform.</li>
        <li>Use the service for anything illegal under Indian law.</li>
      </ul>

      <h2>4. Fees</h2>
      <p>
        Baari is free during early access. If we begin charging, we&apos;ll
        notify signed-in users at least 30 days before any fee is due. You
        may cancel at any time before charges begin.
      </p>

      <h2>5. Your data</h2>
      <p>
        You own your data (workspace details, bookings, customer records).
        We process it on your behalf under our{" "}
        <a href="/legal/privacy">Privacy Policy</a>. You may export or delete
        your data at any time from the settings screen.
      </p>

      <h2>6. Content posted by you</h2>
      <p>
        Any content you post (workspace name, address, services, hours) must
        be accurate. Content that&apos;s misleading, offensive, or infringes
        another party&apos;s rights may be removed. Repeated violations may
        result in account suspension.
      </p>

      <h2>7. Availability</h2>
      <p>
        We aim for high uptime but don&apos;t guarantee uninterrupted service.
        We may occasionally take the service down for maintenance,
        upgrades, or emergencies. We&apos;ll try to notify you in advance
        when possible.
      </p>

      <h2>8. Third-party services</h2>
      <p>
        The service integrates with Google Sign-In, Resend (email), PostHog
        (analytics), Neon (database), and Railway (hosting). Use of those
        services is subject to their own terms.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        The service is provided &quot;as is&quot; and &quot;as available.&quot; To the extent
        permitted by law, Baari disclaims all warranties, express or implied,
        including fitness for a particular purpose and non-infringement.
        Baari is not a medical, legal, or financial advisor; the service
        does not provide diagnosis, treatment, or professional advice.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Baari&apos;s aggregate
        liability arising out of or relating to these Terms or the service
        shall not exceed the amount you paid to Baari in the 12 months
        preceding the claim (or ₹1,000 if you paid nothing).
      </p>

      <h2>11. Suspension and termination</h2>
      <p>
        We may suspend or terminate accounts that violate these Terms,
        infringe others&apos; rights, or expose Baari to legal risk. You may
        close your account at any time from the settings screen. Termination
        does not relieve you of obligations incurred before the effective
        date.
      </p>

      <h2>12. Changes to the Terms</h2>
      <p>
        We may update these Terms from time to time. We&apos;ll update the
        &quot;Last updated&quot; date at the top. For material changes,
        we&apos;ll notify signed-in users at least 7 days before the change
        takes effect.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These Terms are governed by the laws of India. Any dispute shall be
        subject to the exclusive jurisdiction of the courts of Bengaluru,
        Karnataka.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href="mailto:hello@getbaari.in">hello@getbaari.in</a>
      </p>
    </>
  );
}
