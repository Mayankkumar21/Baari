"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { requireSession } from "@/lib/session";

// One-shot dismiss. Idempotent — running twice on the same user is a
// no-op because the WHERE clause requires onboarded_at IS NULL, which
// keeps the FIRST dismissal timestamp stable for analytics.
export async function dismissOnboardingTour(): Promise<void> {
  const sess = await requireSession();
  await db
    .update(schema.users)
    .set({ onboardedAt: new Date() })
    .where(
      and(
        eq(schema.users.id, sess.user.id),
        isNull(schema.users.onboardedAt),
      ),
    );
}
