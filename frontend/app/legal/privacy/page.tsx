import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — Baari",
  description:
    "How Baari collects, uses, and protects information from businesses and their customers, aligned with India's DPDP Act.",
};

// Last-updated: adjust when substantive changes ship. Rendered
// visibly at the top so users can see when the policy last changed
// without digging into git history.
const LAST_UPDATED = "5 July 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">
        Last updated: {LAST_UPDATED}
      </p>

      <p>
        Baari (&quot;we&quot;, &quot;us&quot;) provides a queue and appointment
        management service for local businesses. This policy explains what
        information we collect, how we use it, and the choices you have. It
        is aligned with the Digital Personal Data Protection Act, 2023 (DPDP
        Act, India).
      </p>

      <h2>Who&apos;s covered</h2>
      <ul>
        <li>
          <strong>Business owners</strong> and their staff who sign in to the
          Baari dashboard or mobile owner app to run their queue.
        </li>
        <li>
          <strong>Customers</strong> who use the Baari customer mobile app,
          the missed-call booking link, or the walk-in flow to book at a
          participating business.
        </li>
      </ul>

      <h2>What we collect</h2>

      <h3>From business owners</h3>
      <ul>
        <li>
          Mobile number, name, workspace name, workspace type, opening hours,
          services, address, and a recovery email (used for password reset
          only).
        </li>
        <li>Authentication data: a bcrypt-hashed password. We never store your password in plain text.</li>
        <li>Booking data your workspace generates: patient names, mobiles, tokens, timestamps, statuses.</li>
        <li>Usage telemetry via PostHog (EU region) — pages visited, actions taken. No sensitive fields are captured in event payloads.</li>
      </ul>

      <h3>From customers</h3>
      <ul>
        <li>
          Google account identifier (from Google Sign-In), name, email, mobile
          (added by you during onboarding).
        </li>
        <li>Booking history at businesses that use Baari.</li>
        <li>Language preference and notification opt-in.</li>
        <li>Session telemetry (page views, taps) via PostHog.</li>
      </ul>

      <h3>From missed-call / walk-in flows</h3>
      <ul>
        <li>Mobile number and name provided at the counter or via the SMS link.</li>
        <li>Booking metadata (slot, service, token).</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To operate the queue: show today&apos;s bookings, notify customers of their turn, keep an audit trail.</li>
        <li>To authenticate you: verify sign-in credentials, send password-reset codes.</li>
        <li>To improve the product: aggregate usage patterns, identify UX friction.</li>
        <li>To communicate with you: transactional emails (booking confirmations, password resets) from <code>noreply@getbaari.in</code>.</li>
      </ul>

      <p>
        We do <strong>not</strong> sell your data. We do not use booking data
        for advertising. We do not share your customer list with other
        businesses on Baari.
      </p>

      <h2>Where it&apos;s stored</h2>
      <ul>
        <li>Primary database: Neon Postgres (US East).</li>
        <li>Application hosting: Railway (Singapore).</li>
        <li>Email delivery: Resend (Tokyo).</li>
        <li>Analytics: PostHog (EU-Frankfurt).</li>
      </ul>
      <p>
        All data is encrypted in transit (TLS 1.2+) and at rest. Payment card
        data is not stored by Baari; when we start charging, payments will
        run through a payment processor (e.g. Razorpay) that never exposes
        raw card data to us.
      </p>

      <h2>Retention</h2>
      <ul>
        <li>Booking data is retained for the life of your workspace.</li>
        <li>When you delete your workspace, all associated data is permanently deleted within 7 days.</li>
        <li>When a customer deletes their account, their profile is soft-deleted (tombstone kept for restore-on-sign-in) for 30 days, then permanently deleted.</li>
        <li>Login attempt logs and rate-limit buckets are pruned after 24 hours.</li>
        <li>Password reset codes expire after 10 minutes and are deleted after 30 days.</li>
      </ul>

      <h2>Your rights (DPDP Act)</h2>
      <p>
        Under the DPDP Act you have the right to:
      </p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Correct inaccurate data.</li>
        <li>Erase your data (subject to legal-hold exceptions).</li>
        <li>Grievance redressal via our Data Protection Officer.</li>
      </ul>
      <p>
        To exercise any of these, email{" "}
        <a href="mailto:privacy@getbaari.in">privacy@getbaari.in</a>. We
        respond within 30 days.
      </p>

      <h2>Cookies</h2>
      <p>
        The dashboard uses one strictly-necessary cookie (<code>baari_session</code>)
        to keep you signed in. It is HTTP-only, secure, and set to
        SameSite=Strict. We do not use tracking cookies.
      </p>

      <h2>Third-party services</h2>
      <p>
        Google Sign-In is used for customer authentication only; we receive
        your Google ID, email, and name — nothing else. Google&apos;s privacy
        policy applies to the sign-in flow itself.
      </p>

      <h2>Children</h2>
      <p>
        Baari is not intended for use by anyone under 18 without parental
        consent. If we discover an account belongs to a child under 18, we
        will contact the account holder to obtain verifiable parental
        consent or delete the account.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We&apos;ll update the &quot;Last updated&quot; date at the top when
        we make changes. For material changes (new data collection, new
        third-party processors), we&apos;ll notify signed-in users by email
        at least 7 days before the change takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        Data Protection Officer:{" "}
        <a href="mailto:privacy@getbaari.in">privacy@getbaari.in</a>
        <br />
        General questions:{" "}
        <a href="mailto:hello@getbaari.in">hello@getbaari.in</a>
      </p>
    </>
  );
}
