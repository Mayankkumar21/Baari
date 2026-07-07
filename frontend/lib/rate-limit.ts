// DB-backed fixed-window rate limit. Port of app/services/rate_limit.py.
// Fails OPEN on DB errors — security guard, not a hard wall.
import { eq, lt, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";

type LimitSpec = { limit: number; windowSeconds: number };

export const LIMITS: Record<string, LimitSpec> = {
  signup_per_ip: { limit: 5, windowSeconds: 3600 },
  signup_per_mobile: { limit: 3, windowSeconds: 3600 },
  login_per_ip: { limit: 30, windowSeconds: 600 },
  login_per_mobile: { limit: 10, windowSeconds: 600 },
  // Forgot-password: tighter than login. Owners rarely reset — a
  // burst almost always means enumeration or spamming a mailbox.
  reset_per_ip: { limit: 5, windowSeconds: 3600 },
  reset_per_mobile: { limit: 3, windowSeconds: 3600 },
  // Email-send caps — enforced right before we hand a message to
  // Resend. Deliberately strict: we control the outbox and email is
  // the most abusable channel we expose. These stack with the flow-
  // specific IP/mobile buckets above — the tightest applicable one
  // wins.
  //
  //   email_recipient_hour  — no one inbox gets more than 3 emails
  //                           from us in an hour, even across flows
  //                           (reset + verify). Protects a target
  //                           mailbox from harassment.
  //   email_recipient_day   — 8 per day per inbox. Covers legitimate
  //                           reset+resend+verify+change bursts
  //                           while stopping slow-drip abuse.
  //   email_user_hour       — 4 per hour per user_id, for the
  //                           session-authed email/start flow. Stops
  //                           a compromised session from burning
  //                           through an account's quota.
  //   email_global_day      — global fuse. Set well below Resend's
  //                           free-tier daily (100/day) and Vercel's
  //                           bounce reputation ceiling, so a runaway
  //                           bug can't get us flagged.
  email_recipient_hour: { limit: 3, windowSeconds: 3600 },
  email_recipient_day: { limit: 8, windowSeconds: 86_400 },
  email_user_hour: { limit: 4, windowSeconds: 3600 },
  email_global_day: { limit: 500, windowSeconds: 86_400 },
  // Booking-flow caps — mostly to stop a compromised customer session
  // from spamming the DB with fake bookings or grinding the T-token
  // uniqueness retry loop.
  //   booking_create_per_customer — a normal user creates maybe 1-3
  //     bookings a day. 10 in an hour is well past legitimate use.
  //   booking_create_per_ip       — catches unauth'd requests hitting
  //     the /b/[token] missed-call flow and abuse of shared IPs.
  //   b_confirm_per_ip            — /b/[token] confirmation is public
  //     (only the URL token gates it), so IP-level is the only signal.
  booking_create_per_customer: { limit: 10, windowSeconds: 3600 },
  booking_create_per_ip: { limit: 30, windowSeconds: 3600 },
  b_confirm_per_ip: { limit: 20, windowSeconds: 3600 },
  // Customer profile mutations. Mobile-changes trigger a patient-row
  // cascade update — expensive, and abusable to force churn.
  profile_update_per_customer: { limit: 5, windowSeconds: 3600 },
  // Customer signup via Google. Google verification is strong (real
  // audience+sub check) but nothing stops a bot with N real Google
  // accounts from spinning up customers all day and inflating stats.
  signup_google_per_ip: { limit: 10, windowSeconds: 3600 },
  signup_google_per_email: { limit: 5, windowSeconds: 86_400 },
  // Public GETs — clinics list/search/detail/slots. No auth, so an
  // aggressive scraper could otherwise pound them. 60/min is far above
  // any human's discover-flow rate (Discover screen ~2 requests, clinic
  // detail 1 request, slot fetch 1 per day-tap → maybe 10 in a
  // browsing session).
  public_get_per_ip: { limit: 60, windowSeconds: 60 },
  // Polling GETs — /owner/queue polled every 30s, /bookings/[id]/status
  // polled every ~15s while a customer waits. Cap at rates that leave
  // headroom for both polling intervals PLUS a screen refocus refetch.
  // 240/hr = one poll every 15s continuously — enough for real use,
  // stops a runaway loop from a compromised session.
  poll_per_user: { limit: 240, windowSeconds: 3600 },
  // Owner queue mutations (checkin/start/done/no-show/cancel/walkin).
  // Each mutation triggers `tryPromoteNextBooking` which does 3-4 DB
  // round-trips, so a stuck client or a compromised owner session can
  // pound the DB fast. A busy clinic legitimately runs maybe 3-5
  // mutations per patient × 40 patients/day → 200/day. 600/hr is well
  // above that for burst periods but tight enough to cap runaways.
  owner_mutation_per_user: { limit: 600, windowSeconds: 3600 },
};

export async function checkAndIncrement(
  spec: LimitSpec,
  ...keyParts: string[]
): Promise<{ ok: boolean; remaining: number }> {
  try {
    const windowIndex = Math.floor(Date.now() / 1000 / spec.windowSeconds);
    const bucketKey = [...keyParts, windowIndex].join(":").slice(0, 180);

    // UPSERT count = count + 1; return new value.
    const [row] = await db
      .insert(schema.rateLimitBuckets)
      .values({ bucketKey, count: 1 })
      .onConflictDoUpdate({
        target: schema.rateLimitBuckets.bucketKey,
        set: { count: sql`${schema.rateLimitBuckets.count} + 1` },
      })
      .returning({ count: schema.rateLimitBuckets.count });

    const remaining = Math.max(0, spec.limit - (row?.count ?? 0));
    return { ok: (row?.count ?? 0) <= spec.limit, remaining };
  } catch (err) {
    console.warn("[rate-limit] fail-open due to db error:", err);
    return { ok: true, remaining: spec.limit };
  }
}

export async function gcOldBuckets(maxAgeHours = 24): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - maxAgeHours * 3600 * 1000);
    const result = await db
      .delete(schema.rateLimitBuckets)
      .where(lt(schema.rateLimitBuckets.createdAt, cutoff));
    return (result as { rowCount?: number }).rowCount ?? 0;
  } catch {
    return 0;
  }
}
