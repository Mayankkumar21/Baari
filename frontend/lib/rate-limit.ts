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
