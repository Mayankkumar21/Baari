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
